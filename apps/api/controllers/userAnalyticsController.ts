// @ts-nocheck
import { Request, Response, NextFunction } from "express"; type RequestHandler = any;
import asyncHandler from "express-async-handler";
import Order from "../models/orderModel.js";
import mongoose from "mongoose";

// @desc    Get user analytics overview
// @route   GET /api/user-analytics/overview
// @access  Private/User
const getUserAnalyticsOverview: RequestHandler = asyncHandler(async (req, res) => {
  try {
    const userId = req.user._id;

    // Get total orders for user
    const totalOrders = await Order.countDocuments({ userId });

    // Get completed orders count
    const completedOrders = await Order.countDocuments({
      userId,
      status: { $in: ["delivered", "completed"] },
    });

    // Get pending orders count
    const pendingOrders = await Order.countDocuments({
      userId,
      status: { $in: ["pending", "processing", "shipped"] },
    });

    // Get cancelled orders count
    const cancelledOrders = await Order.countDocuments({
      userId,
      status: "cancelled",
    });

    // Get total amount spent
    const totalSpentAggregation = await Order.aggregate([
      { $match: { userId: new mongoose.Types.ObjectId(userId) } },
      { $group: { _id: null, totalSpent: { $sum: "$total" } } },
    ]);
    const totalSpent = totalSpentAggregation[0]?.totalSpent || 0;

    // Get paid amount
    const paidAmountAggregation = await Order.aggregate([
      {
        $match: {
          userId: new mongoose.Types.ObjectId(userId),
          status: { $in: ["paid", "delivered", "completed"] },
        },
      },
      { $group: { _id: null, paidAmount: { $sum: "$total" } } },
    ]);
    const paidAmount = paidAmountAggregation[0]?.paidAmount || 0;

    // Get average order value
    const avgOrderValue = totalOrders > 0 ? totalSpent / totalOrders : 0;

    // Get total items purchased
    const totalItemsAggregation = await Order.aggregate([
      { $match: { userId: new mongoose.Types.ObjectId(userId) } },
      { $unwind: "$items" },
      { $group: { _id: null, totalItems: { $sum: "$items.quantity" } } },
    ]);
    const totalItems = totalItemsAggregation[0]?.totalItems || 0;

    // Get favorite categories
    const favoriteCategories = await Order.aggregate([
      { $match: { userId: new mongoose.Types.ObjectId(userId) } },
      { $unwind: "$items" },
      {
        $group: {
          _id: "$items.category",
          totalSpent: {
            $sum: { $multiply: ["$items.price", "$items.quantity"] },
          },
          itemCount: { $sum: "$items.quantity" },
          orderCount: { $sum: 1 },
        },
      },
      { $sort: { totalSpent: -1 } },
      { $limit: 5 },
    ]);

    // Get spending by status
    const spendingByStatus = await Order.aggregate([
      { $match: { userId: new mongoose.Types.ObjectId(userId) } },
      {
        $group: {
          _id: "$status",
          totalAmount: { $sum: "$total" },
          orderCount: { $sum: 1 },
        },
      },
    ]);

    res.json({
      success: true,
      data: {
        overview: {
          totalOrders,
          completedOrders,
          pendingOrders,
          cancelledOrders,
          totalSpent,
          paidAmount,
          avgOrderValue,
          totalItems,
        },
        favoriteCategories,
        spendingByStatus,
      },
    });
  } catch (error) {
    console.error("User analytics overview error:", error);
    res.status(500);
    throw new Error("Failed to fetch user analytics overview");
  }
});

// @desc    Get user monthly spending analytics
// @route   GET /api/user-analytics/monthly-spending
// @access  Private/User
const getUserMonthlySpending: RequestHandler = asyncHandler(async (req, res) => {
  try {
    const userId = req.user._id;
    const { months = 12 } = req.query as any;

    // Get monthly spending for the specified number of months
    const monthsAgo = new Date();
    monthsAgo.setMonth(monthsAgo.getMonth() - parseInt(months));

    const monthlySpending = await Order.aggregate([
      {
        $match: {
          userId: new mongoose.Types.ObjectId(userId),
          createdAt: { $gte: monthsAgo },
        },
      },
      {
        $group: {
          _id: {
            year: { $year: "$createdAt" },
            month: { $month: "$createdAt" },
          },
          totalSpent: { $sum: "$total" },
          paidAmount: {
            $sum: {
              $cond: [
                { $in: ["$status", ["paid", "delivered", "completed"]] },
                "$total",
                0,
              ],
            },
          },
          orderCount: { $sum: 1 },
          completedOrders: {
            $sum: {
              $cond: [{ $in: ["$status", ["delivered", "completed"]] }, 1, 0],
            },
          },
        },
      },
      { $sort: { "_id.year": 1, "_id.month": 1 } },
    ]);

    // Format the data for better frontend consumption
    const formattedData = monthlySpending.map((item) => ({
      year: item._id.year,
      month: item._id.month,
      monthName: new Date(item._id.year, item._id.month - 1).toLocaleString(
        "default",
        { month: "long" }
      ),
      totalSpent: item.totalSpent,
      paidAmount: item.paidAmount,
      orderCount: item.orderCount,
      completedOrders: item.completedOrders,
      avgOrderValue:
        item.orderCount > 0 ? item.totalSpent / item.orderCount : 0,
    }));

    res.json({
      success: true,
      data: {
        monthlySpending: formattedData,
        period: `${months} months`,
      },
    });
  } catch (error) {
    console.error("User monthly spending error:", error);
    res.status(500);
    throw new Error("Failed to fetch user monthly spending analytics");
  }
});

// @desc    Get user order history analytics
// @route   GET /api/user-analytics/order-history
// @access  Private/User
const getUserOrderHistory: RequestHandler = asyncHandler(async (req, res) => {
  try {
    const userId = req.user._id;
    const { page = 1, limit = 10 } = req.query as any;
    const skip = (page - 1) * limit;

    // Get detailed order history with analytics
    const orderHistory = await Order.find({ userId })
      .select("total status createdAt items deliveredAt")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean();

    // Calculate analytics for each order
    const enrichedHistory = orderHistory.map((order: any) => ({
      ...order,
      itemCount:
        order.items?.reduce((sum: any, item: any) => sum + (item.quantity || 0), 0) || 0,
      avgItemPrice:
        order.items?.length > 0
          ? order.total /
            order.items.reduce((sum: any, item: any) => sum + (item.quantity || 0), 0)
          : 0,
      deliveryTime:
        order.deliveredAt && order.createdAt
          ? Math.ceil(
              (new Date(order.deliveredAt).getTime() - new Date(order.createdAt).getTime()) /
                (1000 * 60 * 60 * 24)
            )
          : null,
    }));

    // Get total count for pagination
    const totalOrders = await Order.countDocuments({ userId });
    const totalPages = Math.ceil(totalOrders / limit);

    res.json({
      success: true,
      data: {
        orders: enrichedHistory,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: totalOrders,
          totalPages,
          hasNextPage: page < totalPages,
          hasPrevPage: page > 1,
        },
      },
    });
  } catch (error) {
    console.error("User order history error:", error);
    res.status(500);
    throw new Error("Failed to fetch user order history analytics");
  }
});

// @desc    Get user product preferences analytics
// @route   GET /api/user-analytics/product-preferences
// @access  Private/User
const getUserProductPreferences: RequestHandler = asyncHandler(async (req, res) => {
  try {
    const userId = req.user._id;

    // Get most purchased products
    const mostPurchasedProducts = await Order.aggregate([
      { $match: { userId: new mongoose.Types.ObjectId(userId) } },
      { $unwind: "$items" },
      {
        $group: {
          _id: "$items.productId",
          productName: { $first: "$items.name" },
          productImage: { $first: "$items.image" },
          category: { $first: "$items.category" },
          totalQuantity: { $sum: "$items.quantity" },
          totalSpent: {
            $sum: { $multiply: ["$items.price", "$items.quantity"] },
          },
          avgPrice: { $avg: "$items.price" },
          orderCount: { $sum: 1 },
        },
      },
      { $sort: { totalQuantity: -1 } },
      { $limit: 10 },
    ]);

    // Get spending by category
    const spendingByCategory = await Order.aggregate([
      { $match: { userId: new mongoose.Types.ObjectId(userId) } },
      { $unwind: "$items" },
      {
        $group: {
          _id: "$items.category",
          totalSpent: {
            $sum: { $multiply: ["$items.price", "$items.quantity"] },
          },
          itemCount: { $sum: "$items.quantity" },
          uniqueProducts: { $addToSet: "$items.productId" },
          orderCount: { $sum: 1 },
        },
      },
      {
        $addFields: {
          uniqueProductCount: { $size: "$uniqueProducts" },
        },
      },
      { $sort: { totalSpent: -1 } },
      { $project: { uniqueProducts: 0 } }, // Remove the array for cleaner response
    ]);

    // Get price range preferences
    const priceRangePreferences = await Order.aggregate([
      { $match: { userId: new mongoose.Types.ObjectId(userId) } },
      { $unwind: "$items" },
      {
        $bucket: {
          groupBy: "$items.price",
          boundaries: [0, 25, 50, 100, 200, 500, 1000, Infinity],
          default: "Other",
          output: {
            count: { $sum: "$items.quantity" },
            totalSpent: {
              $sum: { $multiply: ["$items.price", "$items.quantity"] },
            },
            avgPrice: { $avg: "$items.price" },
          },
        },
      },
    ]);

    // Format price ranges
    const priceRangeLabels = {
      0: "$0 - $25",
      25: "$25 - $50",
      50: "$50 - $100",
      100: "$100 - $200",
      200: "$200 - $500",
      500: "$500 - $1000",
      1000: "$1000+",
      Other: "Other",
    };

    const formattedPriceRanges = priceRangePreferences.map((range) => ({
      range: priceRangeLabels[range._id] || range._id,
      count: range.count,
      totalSpent: range.totalSpent,
      avgPrice: range.avgPrice,
    }));

    res.json({
      success: true,
      data: {
        mostPurchasedProducts,
        spendingByCategory,
        priceRangePreferences: formattedPriceRanges,
      },
    });
  } catch (error) {
    console.error("User product preferences error:", error);
    res.status(500);
    throw new Error("Failed to fetch user product preferences analytics");
  }
});

export {
  getUserAnalyticsOverview,
  getUserMonthlySpending,
  getUserOrderHistory,
  getUserProductPreferences,
};
