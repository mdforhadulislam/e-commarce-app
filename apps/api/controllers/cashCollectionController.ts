import { RequestHandler } from "express";
import asyncHandler from "express-async-handler";
import CashCollection from "../models/cashCollectionModel.js";
import Order from "../models/orderModel.js";
import User from "../models/userModel.js";
import { PaginationQuery, RequestWithQuery, RequestWithBody } from "../types/express.js";

interface CollectionQuery extends PaginationQuery {
  status?: string;
  threshold?: number;
}

interface SubmissionBody {
  collectionIds: string[];
  accountsUserId: string;
  notes?: string;
}

interface ConfirmBody {
  collectionIds: string[];
  notes?: string;
}

// @desc    Get deliveryman's cash collections
// @route   GET /api/cash-collections/my-collections
// @access  Private/Deliveryman
const getMyCollections: RequestHandler = asyncHandler(async (req: RequestWithQuery<CollectionQuery>, res) => {
  const { status } = req.query;

  // First, backfill any missing collections for this deliveryman
  const ordersWithCash = await Order.find({
    codCollectedBy: req.user._id,
    codCollectedAt: { $exists: true },
  }).select("_id total codCollectedBy codCollectedAt paymentStatus status");

  for (const order of ordersWithCash) {
    // Check if CashCollection already exists
    const existing = await CashCollection.findOne({ orderId: order._id });

    if (!existing) {
      // Determine status based on order status
      let collectionStatus = "collected";
      if (order.status === "completed") {
        collectionStatus = "confirmed";
      } else if (order.status === "delivered") {
        collectionStatus = "collected"; // Still pending submission
      }

      // Create CashCollection record
      await CashCollection.create({
        orderId: order._id,
        amount: order.total,
        collectedBy: order.codCollectedBy,
        collectedAt: order.codCollectedAt,
        status: collectionStatus,
      });
    }
  }

  let filter: Record<string, any> = {
    collectedBy: req.user._id,
  };

  // Filter by status if provided
  if (status) {
    filter.status = status;
  }

  const collections = await CashCollection.find(filter)
    .populate("orderId", "orderNumber total userId shippingAddress")
    .populate("orderId.userId", "name phone")
    .populate("submittedToAccounts", "name email")
    .populate("confirmedByAccounts", "name email")
    .sort({ collectedAt: -1 });

  // Calculate totals
  const totalCollected = collections.reduce(
    (sum, collection) => sum + collection.amount,
    0
  );
  const totalPending = collections
    .filter((c) => c.status === "collected")
    .reduce((sum, collection) => sum + collection.amount, 0);
  const totalSubmitted = collections
    .filter((c) => c.status === "submitted")
    .reduce((sum, collection) => sum + collection.amount, 0);
  const totalConfirmed = collections
    .filter((c) => c.status === "confirmed")
    .reduce((sum, collection) => sum + collection.amount, 0);

  res.json({
    success: true,
    data: {
      collections,
      totals: {
        totalCollected,
        totalPending,
        totalSubmitted,
        totalConfirmed,
      },
    },
  });
});

// @desc    Get all accounts employees for submission
// @route   GET /api/cash-collections/accounts-employees
// @access  Private/Deliveryman
const getAccountsEmployees: RequestHandler = asyncHandler(async (req, res) => {
  const accountsEmployees = await User.find({
    role: "employee",
    employee_role: "accounts",
  }).select("name email");

  res.json({
    success: true,
    data: accountsEmployees,
  });
});

// @desc    Submit collected cash to accounts
// @route   PUT /api/cash-collections/submit
// @access  Private/Deliveryman
const submitToAccounts: RequestHandler = asyncHandler(async (req: RequestWithBody<SubmissionBody>, res) => {
  const { collectionIds, accountsUserId, notes } = req.body;

  if (
    !collectionIds ||
    !Array.isArray(collectionIds) ||
    collectionIds.length === 0
  ) {
    res.status(400);
    throw new Error("Please provide collection IDs to submit");
  }

  // Validate accounts user
  const accountsUser = await User.findById(accountsUserId);
  if (
    !accountsUser ||
    accountsUser.role !== "employee" ||
    accountsUser.employee_role !== "accounts"
  ) {
    res.status(400);
    throw new Error("Invalid accounts user selected");
  }

  // Update all collections
  const collections = await CashCollection.find({
    _id: { $in: collectionIds },
    collectedBy: req.user._id,
    status: "collected",
  });

  if (collections.length === 0) {
    res.status(400);
    throw new Error("No valid collections found to submit");
  }

  if (collections.length !== collectionIds.length) {
    res.status(400);
    throw new Error(
      "Some collections are not found or already submitted/confirmed"
    );
  }

  // Update all collections to submitted status
  await CashCollection.updateMany(
    {
      _id: { $in: collectionIds },
      collectedBy: req.user._id,
      status: "collected",
    },
    {
      $set: {
        status: "submitted",
        submittedToAccounts: accountsUserId,
        submittedAt: new Date(),
        notes: notes || "",
      },
    }
  );

  const totalAmount = collections.reduce((sum, c) => sum + c.amount, 0);

  res.json({
    success: true,
    message: `Successfully submitted ${collections.length} collections totaling $${totalAmount} to ${accountsUser.name}`,
    data: {
      submittedCount: collections.length,
      totalAmount,
      submittedTo: accountsUser.name,
    },
  });
});

// @desc    Get pending cash submissions for accounts
// @route   GET /api/cash-collections/accounts/pending
// @access  Private/Accounts
const getAccountsPendingSubmissions: RequestHandler = asyncHandler(async (req, res) => {
  // Get submissions assigned to this accounts user or all if admin
  let filter: Record<string, any> = {
    status: "submitted",
  };

  // If not admin, only show submissions to this accounts user
  if (req.user.role !== "admin") {
    filter.submittedToAccounts = req.user._id;
  }

  const submissions = await CashCollection.find(filter)
    .populate("orderId", "orderNumber total userId shippingAddress")
    .populate("orderId.userId", "name phone")
    .populate("collectedBy", "name email")
    .populate("submittedToAccounts", "name email")
    .sort({ submittedAt: 1 });

  // Group by deliveryman
  const groupedByDeliveryman = submissions.reduce((acc: any, submission) => {
    const deliverymanId = submission.collectedBy._id.toString();
    if (!acc[deliverymanId]) {
      acc[deliverymanId] = {
        deliveryman: submission.collectedBy,
        collections: [],
        totalAmount: 0,
      };
    }
    acc[deliverymanId].collections.push(submission);
    acc[deliverymanId].totalAmount += submission.amount;
    return acc;
  }, {});

  res.json({
    success: true,
    data: {
      submissions,
      groupedByDeliveryman: Object.values(groupedByDeliveryman),
      totalPendingAmount: submissions.reduce((sum, s) => sum + s.amount, 0),
      totalSubmissions: submissions.length,
    },
  });
});

// @desc    Get received (confirmed) cash submissions for accounts
// @route   GET /api/cash-collections/accounts/received
// @access  Private/Accounts
const getAccountsReceivedSubmissions: RequestHandler = asyncHandler(async (req, res) => {
  // Get confirmed submissions
  let filter: Record<string, any> = {
    status: "confirmed",
  };

  // If not admin, only show submissions confirmed by this accounts user
  if (req.user.role !== "admin") {
    filter.confirmedByAccounts = req.user._id;
  }

  const submissions = await CashCollection.find(filter)
    .populate("orderId", "orderNumber total userId shippingAddress status")
    .populate("orderId.userId", "name phone")
    .populate("collectedBy", "name email")
    .populate("submittedToAccounts", "name email")
    .populate("confirmedByAccounts", "name email")
    .sort({ confirmedAt: -1 });

  res.json({
    success: true,
    data: submissions,
  });
});

// @desc    Confirm cash receipt by accounts
// @route   PUT /api/cash-collections/accounts/confirm
// @access  Private/Accounts
const confirmCashReceipt: RequestHandler = asyncHandler(async (req: RequestWithBody<ConfirmBody>, res) => {
  const { collectionIds, notes } = req.body;

  if (
    !collectionIds ||
    !Array.isArray(collectionIds) ||
    collectionIds.length === 0
  ) {
    res.status(400);
    throw new Error("Please provide collection IDs to confirm");
  }

  // Find collections submitted to this accounts user or all if admin
  let filter: Record<string, any> = {
    _id: { $in: collectionIds },
    status: "submitted",
  };

  // If not admin, only confirm submissions to this accounts user
  if (req.user.role !== "admin") {
    filter.submittedToAccounts = req.user._id;
  }

  const collections = await CashCollection.find(filter).populate(
    "orderId",
    "orderNumber total status"
  );

  if (collections.length === 0) {
    res.status(400);
    throw new Error("No valid collections found to confirm");
  }

  if (collections.length !== collectionIds.length) {
    res.status(400);
    throw new Error(
      "Some collections are not found, not submitted to you, or already confirmed"
    );
  }

  // Update collections to confirmed
  await CashCollection.updateMany(filter, {
    $set: {
      status: "confirmed",
      confirmedByAccounts: req.user._id,
      confirmedAt: new Date(),
      notes: notes || "",
    },
  });

  // Get all unique order IDs from these collections
  const orderIds = [...new Set(collections.map((c) => c.orderId._id))];

  // Update all related orders that are "delivered" to "completed"
  const updatedOrders = await Order.updateMany(
    {
      _id: { $in: orderIds },
      status: "delivered",
    },
    {
      $set: {
        status: "completed",
      },
    }
  );

  const totalAmount = collections.reduce((sum, c) => sum + c.amount, 0);

  res.json({
    success: true,
    message: `Successfully confirmed ${collections.length} collections totaling $${totalAmount}. ${updatedOrders.modifiedCount} orders marked as completed.`,
    data: {
      confirmedCount: collections.length,
      totalAmount,
      ordersCompleted: updatedOrders.modifiedCount,
    },
  });
});

// @desc    Get accounts collection statistics
// @route   GET /api/cash-collections/accounts/stats
// @access  Private/Accounts or Admin
const getAccountsStats: RequestHandler = asyncHandler(async (req, res) => {
  // Get overall stats by status
  const stats = await CashCollection.aggregate([
    {
      $group: {
        _id: "$status",
        count: { $sum: 1 },
        totalAmount: { $sum: "$amount" },
      },
    },
  ]);

  // Get confirmed collections (received amount)
  const confirmedCollections = await CashCollection.find({
    status: "confirmed",
  });

  const totalReceived = confirmedCollections.reduce(
    (sum, c) => sum + c.amount,
    0
  );

  // Get my confirmed collections if user is accounts
  let myConfirmedTotal = 0;
  let myConfirmedCount = 0;

  if (req.user.role === "employee" && req.user.employee_role === "accounts") {
    const myConfirmedCollections = await CashCollection.find({
      status: "confirmed",
      "confirmedByAccounts.id": req.user._id,
    });

    myConfirmedTotal = myConfirmedCollections.reduce(
      (sum, c) => sum + c.amount,
      0
    );
    myConfirmedCount = myConfirmedCollections.length;
  }

  // Calculate pending amount from delivered/completed orders with pending payment
  const pendingOrders = await Order.find({
    status: { $in: ["delivered", "completed"] },
    paymentStatus: "pending",
  }).select("total");

  const totalPending = pendingOrders.reduce(
    (sum, order) => sum + order.total,
    0
  );

  res.json({
    success: true,
    data: {
      overallStats: stats,
      totalReceived,
      totalReceivedCount: confirmedCollections.length,
      totalPending,
      totalPendingCount: pendingOrders.length,
      myConfirmedTotal,
      myConfirmedCount,
    },
  });
});

// @desc    Backfill cash collections from existing orders (migration)
// @route   POST /api/cash-collections/backfill
// @access  Private/Admin
const backfillCashCollections: RequestHandler = asyncHandler(async (req, res) => {
  // Find all orders that have codCollectedBy but no CashCollection record
  const ordersWithCash = await Order.find({
    codCollectedBy: { $exists: true },
    codCollectedAt: { $exists: true },
  }).select("_id total codCollectedBy codCollectedAt paymentStatus status");

  let created = 0;
  let skipped = 0;

  for (const order of ordersWithCash) {
    // Check if CashCollection already exists
    const existing = await CashCollection.findOne({ orderId: order._id });

    if (existing) {
      skipped++;
      continue;
    }

    // Determine status based on order status
    let collectionStatus = "collected";
    if (order.status === "completed") {
      collectionStatus = "confirmed";
    } else if (order.status === "delivered") {
      collectionStatus = "submitted";
    }

    // Create CashCollection record
    await CashCollection.create({
      orderId: order._id,
      amount: order.total,
      collectedBy: order.codCollectedBy,
      collectedAt: order.codCollectedAt,
      status: collectionStatus,
      // If completed, mark as confirmed (assume it was handled before the system)
      ...(collectionStatus === "confirmed" && {
        confirmedByAccounts: order.codCollectedBy,
        confirmedAt: order.codCollectedAt,
      }),
    });

    created++;
  }

  res.json({
    success: true,
    message: `Backfill complete: ${created} records created, ${skipped} skipped`,
    data: {
      created,
      skipped,
      total: ordersWithCash.length,
    },
  });
});

export {
  getMyCollections,
  getAccountsEmployees,
  submitToAccounts,
  getAccountsPendingSubmissions,
  getAccountsReceivedSubmissions,
  confirmCashReceipt,
  getAccountsStats,
  backfillCashCollections,
};
