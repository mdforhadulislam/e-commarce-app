// @ts-nocheck
import { Request, Response, NextFunction } from "express"; type RequestHandler = any;
import asyncHandler from "express-async-handler";
import Order from "../models/orderModel.js";
import User from "../models/userModel.js";
import CashCollection from "../models/cashCollectionModel.js";
import mongoose from "mongoose";

// Helper function to add status history with proper user info
const addStatusHistory = (order, status, userId, userName, notes = "") => {
  if (!order.status_history) {
    order.status_history = [];
  }
  order.status_history.push({
    status,
    changed_at: new Date(),
    changed_by: {
      id: userId,
      name: userName,
    },
    notes,
  });
};

// Helper function to update status_updates object
const updateStatusTracking = (order, action, userId, userName) => {
  if (!order.status_updates) {
    order.status_updates = {};
  }

  order.status_updates[action] = {
    by: {
      id: userId,
      name: userName,
    },
    at: new Date(),
  };
};

// @desc    Get orders for call center (pending orders needing address confirmation)
// @route   GET /api/orders/workflow/call-center/queue
// @access  Private/Call Center
const getCallCenterQueue: RequestHandler = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20 } = req.query as any;
  const skip = (page - 1) * limit;

  const orders = await Order.find({
    status: "pending",
    paymentStatus: { $in: ["paid", "pending"] }, // Include COD pending orders
  })
    .populate("userId", "name email phone")
    .sort({ createdAt: 1 })
    .skip(parseInt(skip))
    .limit(parseInt(limit));

  const total = await Order.countDocuments({
    status: "pending",
    paymentStatus: { $in: ["paid", "pending"] },
  });

  res.json({
    success: true,
    data: {
      orders,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / limit),
        hasNextPage: page < Math.ceil(total / limit),
        hasPrevPage: page > 1,
      },
    },
  });
});

// @desc    Confirm order address by call center
// @route   PUT /api/orders/workflow/:id/confirm-address
// @access  Private/Call Center
const confirmOrderAddress: RequestHandler = asyncHandler(async (req, res) => {
  const { shippingAddress } = req.body as any;

  const order = await Order.findById(req.params.id);
  if (!order) {
    res.status(404);
    throw new Error("Order not found");
  }

  // Allow confirming address for pending and address_confirmed orders
  // This allows call center to update address even after initial confirmation
  if (order.status !== "pending" && order.status !== "address_confirmed") {
    res.status(400);
    throw new Error(
      "Cannot confirm address for orders that have already been confirmed for packing"
    );
  }

  // Update shipping address if provided
  if (shippingAddress) {
    // Merge address fields while preserving existing values
    order.shippingAddress = {
      street: shippingAddress.street || order.shippingAddress.street,
      city: shippingAddress.city || order.shippingAddress.city,
      state: shippingAddress.state || order.shippingAddress.state,
      country: shippingAddress.country || order.shippingAddress.country,
      postalCode:
        shippingAddress.postalCode ||
        shippingAddress.zipCode ||
        order.shippingAddress.postalCode,
    };
  }

  const userName = req.user.name || req.user.email;
  order.status = "address_confirmed";

  // Initialize status_updates if it doesn't exist (for old orders)
  if (!order.status_updates) {
    order.status_updates = {};
  }

  // Update status_updates object
  updateStatusTracking(order, "address_confirmed", req.user._id, userName);

  // Mark status_updates as modified for Mongoose to save nested objects
  order.markModified("status_updates");

  // Add to status history
  addStatusHistory(order, "address_confirmed", req.user._id, userName);

  await order.save({ validateBeforeSave: true });

  res.json({
    success: true,
    message: "Order address confirmed successfully",
    data: order,
  });
});

// @desc    Mark order as confirmed (ready for packing)
// @route   PUT /api/orders/workflow/:id/confirm-order
// @access  Private/Call Center/Admin
const confirmOrder: RequestHandler = asyncHandler(async (req, res) => {
  const order = await Order.findById(req.params.id);
  if (!order) {
    res.status(404);
    throw new Error("Order not found");
  }

  if (!["pending", "address_confirmed"].includes(order.status)) {
    res.status(400);
    throw new Error("Order cannot be confirmed at this stage");
  }

  const userName = req.user.name || req.user.email;

  // Initialize status_updates if it doesn't exist (for old orders)
  if (!order.status_updates) {
    order.status_updates = {};
  }

  // If address wasn't confirmed yet, mark it as confirmed now
  if (order.status === "pending") {
    updateStatusTracking(order, "address_confirmed", req.user._id, userName);
  }

  order.status = "confirmed";

  // Update status_updates object for order confirmation
  updateStatusTracking(order, "order_confirmed", req.user._id, userName);

  // Mark status_updates as modified for Mongoose to save nested objects
  order.markModified("status_updates");

  // Add to status history
  addStatusHistory(order, "confirmed", req.user._id, userName);

  await order.save();

  res.json({
    success: true,
    message: "Order confirmed successfully",
    data: order,
  });
});

// @desc    Get orders for packer (confirmed orders ready to be packed)
// @route   GET /api/orders/workflow/packer/queue
// @access  Private/Packer
const getPackerQueue: RequestHandler = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20 } = req.query as any;
  const skip = (page - 1) * limit;

  const orders = await Order.find({
    status: { $in: ["address_confirmed", "confirmed", "processing"] },
  })
    .populate("userId", "name email")
    .sort({ createdAt: 1 })
    .skip(parseInt(skip))
    .limit(parseInt(limit));

  const total = await Order.countDocuments({
    status: { $in: ["address_confirmed", "confirmed", "processing"] },
  });

  res.json({
    success: true,
    data: {
      orders,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / limit),
        hasNextPage: page < Math.ceil(total / limit),
        hasPrevPage: page > 1,
      },
    },
  });
});

// @desc    Assign order to packer
// @route   PUT /api/orders/:id/assign-packer
// @access  Private/Incharge
const assignPacker: RequestHandler = asyncHandler(async (req, res) => {
  const { packerId } = req.body as any;

  // Validate packer
  const packer = await User.findById(packerId);
  if (
    !packer ||
    packer.role !== "employee" ||
    packer.employee_role !== "packer"
  ) {
    res.status(400);
    throw new Error("Invalid packer selected");
  }

  const order = await Order.findById(req.params.id);
  if (!order) {
    res.status(404);
    throw new Error("Order not found");
  }

  if (
    !["address_confirmed", "confirmed", "processing"].includes(order.status)
  ) {
    res.status(400);
    throw new Error("Order is not ready for packing assignment");
  }

  order.assignedPacker = packerId;
  order.status = "processing";

  const userName = req.user.name || req.user.email;
  addStatusHistory(order, "processing", req.user._id, userName);

  await order.save();

  res.json({
    success: true,
    message: "Packer assigned successfully",
    data: order,
  });
});

// @desc    Mark order as packed
// @route   PUT /api/orders/:id/pack
// @access  Private/Packer
const packOrder: RequestHandler = asyncHandler(async (req, res) => {
  const order = await Order.findById(req.params.id);
  if (!order) {
    res.status(404);
    throw new Error("Order not found");
  }

  // Check if user is assigned packer or admin
  // Allow packer role to pack confirmed orders without assignment
  if (
    req.user.role !== "admin" &&
    req.user.employee_role !== "packer" &&
    (!order.assignedPacker ||
      order.assignedPacker.toString() !== req.user._id.toString())
  ) {
    res.status(403);
    throw new Error("You are not assigned to pack this order");
  }

  if (order.status !== "confirmed") {
    res.status(400);
    throw new Error("Order must be confirmed before packing");
  }

  const userName = req.user.name || req.user.email;
  order.status = "packed";

  // Initialize status_updates if it doesn't exist (for old orders)
  if (!order.status_updates) {
    order.status_updates = {};
  }

  // Update status_updates object
  updateStatusTracking(order, "packed", req.user._id, userName);

  // Mark status_updates as modified for Mongoose to save nested objects
  order.markModified("status_updates");

  // Add to status history
  addStatusHistory(order, "packed", req.user._id, userName);

  await order.save();

  res.json({
    success: true,
    message: "Order marked as packed",
    data: order,
  });
});

// @desc    Get packed orders ready for delivery assignment
// @route   GET /api/orders/delivery/queue
// @access  Private/Incharge
const getDeliveryQueue: RequestHandler = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20 } = req.query as any;
  const skip = (page - 1) * limit;

  const orders = await Order.find({
    status: "packed",
  })
    .populate("userId", "name email")
    .sort({ "status_updates.packed.at": 1 })
    .skip(parseInt(skip))
    .limit(parseInt(limit));

  const total = await Order.countDocuments({ status: "packed" });

  res.json({
    success: true,
    data: {
      orders,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / limit),
        hasNextPage: page < Math.ceil(total / limit),
        hasPrevPage: page > 1,
      },
    },
  });
});

// @desc    Assign order to deliveryman
// @route   PUT /api/orders/:id/assign-deliveryman
// @access  Private/Incharge
const assignDeliveryman: RequestHandler = asyncHandler(async (req, res) => {
  const { deliverymanId } = req.body as any;

  // Allow clearing assignment (empty deliverymanId)
  if (deliverymanId) {
    // Validate deliveryman
    const deliveryman = await User.findById(deliverymanId);
    if (
      !deliveryman ||
      deliveryman.role !== "employee" ||
      deliveryman.employee_role !== "deliveryman"
    ) {
      res.status(400);
      throw new Error("Invalid deliveryman selected");
    }
  }

  const order = await Order.findById(req.params.id);
  if (!order) {
    res.status(404);
    throw new Error("Order not found");
  }

  if (order.status !== "packed") {
    res.status(400);
    throw new Error("Order must be packed before delivery assignment");
  }

  const userName = req.user.name || req.user.email;
  order.assignedDeliveryman = deliverymanId || null;
  // Keep status as "packed" - deliveryman will change to "delivering"

  // Add to status history for assignment
  const notes = deliverymanId
    ? "Deliveryman assigned"
    : "Deliveryman assignment cleared";
  addStatusHistory(order, "packed", req.user._id, userName, notes);

  await order.save();

  // Populate assignedDeliveryman before returning (only if assigned)
  if (deliverymanId) {
    await order.populate("assignedDeliveryman", "name email");
  }

  res.json({
    success: true,
    message: deliverymanId
      ? "Deliveryman assigned successfully"
      : "Deliveryman assignment cleared",
    data: order,
  });
});

// @desc    Get orders assigned to deliveryman
// @route   GET /api/orders/my-deliveries
// @access  Private/Deliveryman
const getMyDeliveries: RequestHandler = asyncHandler(async (req, res) => {
  const { status } = req.query as any;

  let filter: any = {
    assignedDeliveryman: req.user._id,
  };

  if (status) {
    filter.status = status;
  } else {
    // Default to active deliveries
    filter.status = { $in: ["packed", "delivering"] };
  }

  const orders = await Order.find(filter)
    .populate("userId", "name email")
    .sort({ "status_updates.packed.at": 1 });

  res.json({
    success: true,
    data: orders,
  });
});

// @desc    Start delivery (mark as delivering)
// @route   PUT /api/orders/:id/start-delivery
// @access  Private/Deliveryman
const startDelivery: RequestHandler = asyncHandler(async (req, res) => {
  const order = await Order.findById(req.params.id);
  if (!order) {
    res.status(404);
    throw new Error("Order not found");
  }

  // Check if user is assigned deliveryman
  if (
    !order.assignedDeliveryman ||
    order.assignedDeliveryman.toString() !== req.user._id.toString()
  ) {
    res.status(403);
    throw new Error("You are not assigned to deliver this order");
  }

  if (order.status !== "packed") {
    res.status(400);
    throw new Error("Order must be packed to start delivery");
  }

  const userName = req.user.name || req.user.email;
  order.status = "delivering";

  // Initialize status_updates if it doesn't exist (for old orders)
  if (!order.status_updates) {
    order.status_updates = {};
  }

  // Update status_updates object
  updateStatusTracking(order, "delivering", req.user._id, userName);

  // Mark status_updates as modified for Mongoose to save nested objects
  order.markModified("status_updates");

  // Add to status history
  addStatusHistory(order, "delivering", req.user._id, userName);

  await order.save();

  res.json({
    success: true,
    message: "Delivery started",
    data: order,
  });
});

// @desc    Collect cash payment from customer (automatically updates payment status)
// @route   PUT /api/orders/workflow/:id/collect-cod
// @access  Private/Admin or Deliveryman
const collectCOD: RequestHandler = asyncHandler(async (req, res) => {
  const order = await Order.findById(req.params.id);
  if (!order) {
    res.status(404);
    throw new Error("Order not found");
  }

  // Check if user is authorized to collect cash
  // Admin can always collect, or deliveryman who either:
  // 1. Is assigned to deliver this order, OR
  // 2. Changed the status to "delivering" (tracking in status_updates)
  if (req.user.role !== "admin") {
    const isAssignedDeliveryman =
      order.assignedDeliveryman &&
      order.assignedDeliveryman.toString() === req.user._id.toString();

    const isDeliveringBy =
      order.status_updates?.delivering?.by?.id?.toString() ===
      req.user._id.toString();

    if (!isAssignedDeliveryman && !isDeliveringBy) {
      res.status(403);
      throw new Error("You are not assigned to deliver this order");
    }
  }

  if (order.status !== "delivering") {
    res.status(400);
    throw new Error("Order must be in delivering status to collect payment");
  }

  if (
    order.paymentStatus === "cod_collected" ||
    order.paymentStatus === "paid"
  ) {
    res.status(400);
    throw new Error("Payment already collected for this order");
  }

  if (order.paymentStatus !== "pending") {
    res.status(400);
    throw new Error("Payment status must be pending to collect payment");
  }

  // Update payment status to paid and track collection details
  order.paymentStatus = "paid";
  order.codAmount = order.total;
  order.codCollectedAt = new Date();
  order.codCollectedBy = req.user._id;
  order.paidAt = new Date();

  const userName = req.user.name || req.user.email;
  const userRole = req.user.role === "admin" ? "Admin" : "Deliveryman";
  addStatusHistory(
    order,
    order.status,
    req.user._id,
    userName,
    `Cash payment of $${order.total} collected from customer by ${userRole} (${userName}). Pending submission to accounts.`
  );

  await order.save();

  // Create a cash collection record for deliveryman tracking
  // Only create for deliverymen, not for admins
  if (req.user.role !== "admin") {
    await CashCollection.create({
      orderId: order._id,
      amount: order.total,
      collectedBy: req.user._id,
      collectedAt: new Date(),
      status: "collected",
    });
  }

  res.json({
    success: true,
    message: "Cash payment collected successfully",
    data: order,
  });
});

// @desc    Mark order as delivered
// @route   PUT /api/orders/:id/deliver
// @access  Private/Deliveryman
const deliverOrder: RequestHandler = asyncHandler(async (req, res) => {
  const order = await Order.findById(req.params.id);
  if (!order) {
    res.status(404);
    throw new Error("Order not found");
  }

  // Check if user is authorized to deliver
  // Deliveryman who either:
  // 1. Is assigned to deliver this order, OR
  // 2. Changed the status to "delivering" (tracking in status_updates)
  const isAssignedDeliveryman =
    order.assignedDeliveryman &&
    order.assignedDeliveryman.toString() === req.user._id.toString();

  const isDeliveringBy =
    order.status_updates?.delivering?.by?.id?.toString() ===
    req.user._id.toString();

  if (!isAssignedDeliveryman && !isDeliveringBy) {
    res.status(403);
    throw new Error("You are not assigned to deliver this order");
  }

  if (order.status !== "delivering") {
    res.status(400);
    throw new Error("Order must be in delivering status to mark as delivered");
  }

  // Payment must be collected first (for any payment method)
  if (order.paymentStatus === "pending") {
    res.status(400);
    throw new Error("Payment must be collected before marking as delivered");
  }

  const userName = req.user.name || req.user.email;
  order.status = "delivered";

  // Initialize status_updates if it doesn't exist (for old orders)
  if (!order.status_updates) {
    order.status_updates = {};
  }

  // Update status_updates object
  updateStatusTracking(order, "delivered", req.user._id, userName);

  // Mark status_updates as modified for Mongoose to save nested objects
  order.markModified("status_updates");

  // Add to status history
  addStatusHistory(order, "delivered", req.user._id, userName);

  await order.save();

  res.json({
    success: true,
    message: "Order marked as delivered",
    data: order,
  });
});

// @desc    Return COD to accounts
// @route   PUT /api/orders/:id/return-cod
// @access  Private/Deliveryman
const returnCOD: RequestHandler = asyncHandler(async (req, res) => {
  const { accountsUserId } = req.body as any;

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

  const order = await Order.findById(req.params.id);
  if (!order) {
    res.status(404);
    throw new Error("Order not found");
  }

  // Check if user is assigned deliveryman
  if (
    !order.assignedDeliveryman ||
    order.assignedDeliveryman.toString() !== req.user._id.toString()
  ) {
    res.status(403);
    throw new Error("You are not assigned to this order");
  }

  if (
    order.paymentMethod !== "cod" ||
    order.paymentStatus !== "cod_collected"
  ) {
    res.status(400);
    throw new Error("No COD to return for this order");
  }

  if (order.codReturnedAt) {
    res.status(400);
    throw new Error("COD already returned for this order");
  }

  order.codReturnedAt = new Date();
  order.codReturnedTo = accountsUserId;

  const userName = req.user.name || req.user.email;
  addStatusHistory(order, order.status, req.user._id, userName);

  await order.save();

  res.json({
    success: true,
    message: "COD returned to accounts",
    data: order,
  });
});

// @desc    Complete order (final step by accounts)
// @route   PUT /api/orders/:id/complete
// @access  Private/Accounts
const completeOrder: RequestHandler = asyncHandler(async (req, res) => {
  const order = await Order.findById(req.params.id);
  if (!order) {
    res.status(404);
    throw new Error("Order not found");
  }

  if (order.status !== "delivered") {
    res.status(400);
    throw new Error("Order must be delivered before completion");
  }

  // For COD orders, ensure COD is returned
  if (order.paymentMethod === "cod" && !order.codReturnedAt) {
    res.status(400);
    throw new Error("COD must be returned before completing the order");
  }

  const userName = req.user.name || req.user.email;
  order.status = "completed";
  order.paymentStatus = "paid"; // Mark as paid regardless of payment method

  // Initialize status_updates if it doesn't exist (for old orders)
  if (!order.status_updates) {
    order.status_updates = {};
  }

  // Update status_updates object
  updateStatusTracking(order, "completed", req.user._id, userName);

  // Mark status_updates as modified for Mongoose to save nested objects
  order.markModified("status_updates");

  // Add to status history
  addStatusHistory(order, "completed", req.user._id, userName);

  await order.save();

  res.json({
    success: true,
    message: "Order completed successfully",
    data: order,
  });
});

// @desc    Get orders pending COD return
// @route   GET /api/orders/accounts/cod-pending
// @access  Private/Accounts
const getCODPendingOrders: RequestHandler = asyncHandler(async (req, res) => {
  const orders = await Order.find({
    paymentMethod: "cod",
    paymentStatus: "cod_collected",
    codReturnedAt: { $exists: false },
  })
    .populate("assignedDeliveryman", "name")
    .populate("userId", "name email")
    .sort({ codCollectedAt: 1 });

  res.json({
    success: true,
    data: orders,
  });
});

// @desc    Get delivered orders ready for completion
// @route   GET /api/orders/accounts/completion-queue
// @access  Private/Accounts
const getCompletionQueue: RequestHandler = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20 } = req.query as any;
  const skip = (page - 1) * limit;

  const orders = await Order.find({
    status: "delivered",
  })
    .populate("userId", "name email")
    .populate("assignedDeliveryman", "name")
    .sort({ "status_updates.delivered.at": 1 })
    .skip(parseInt(skip))
    .limit(parseInt(limit));

  const total = await Order.countDocuments({ status: "delivered" });

  res.json({
    success: true,
    data: {
      orders,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / limit),
        hasNextPage: page < Math.ceil(total / limit),
        hasPrevPage: page > 1,
      },
    },
  });
});

// @desc    Get workflow statistics
// @route   GET /api/orders/workflow/stats
// @access  Private/Employee
const getWorkflowStats: RequestHandler = asyncHandler(async (req, res) => {
  const stats = await Order.aggregate([
    {
      $group: {
        _id: "$status",
        count: { $sum: 1 },
        totalValue: { $sum: "$total" },
      },
    },
  ]);

  const codStats = await Order.aggregate([
    {
      $match: { paymentMethod: "cod" },
    },
    {
      $group: {
        _id: "$paymentStatus",
        count: { $sum: 1 },
        totalAmount: { $sum: "$codAmount" },
      },
    },
  ]);

  res.json({
    success: true,
    data: {
      orderStats: stats,
      codStats,
    },
  });
});

export {
  getCallCenterQueue,
  confirmOrderAddress,
  confirmOrder,
  getPackerQueue,
  assignPacker,
  packOrder,
  getDeliveryQueue,
  assignDeliveryman,
  getMyDeliveries,
  startDelivery,
  collectCOD,
  deliverOrder,
  returnCOD,
  completeOrder,
  getCODPendingOrders,
  getCompletionQueue,
  getWorkflowStats,
};
