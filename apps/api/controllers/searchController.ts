// @ts-nocheck
import { Request, Response, NextFunction } from "express"; type RequestHandler = any;
import asyncHandler from "express-async-handler";
import User from "../models/userModel.js";
import Product from "../models/productModel.js";
import Order from "../models/orderModel.js";

// @desc    Global search across users, products, and orders
// @route   GET /api/search
// @access  Private/Admin
const globalSearch: RequestHandler = asyncHandler(async (req, res) => {
  const { query, type = "all", limit = 10 } = req.query as any;

  if (!query || query.trim() === "") {
    res.status(400);
    throw new Error("Search query is required");
  }

  const searchQuery = query.trim();
  const results = {
    users: [],
    products: [],
    orders: [],
    total: 0,
  };

  try {
    // Search Users (by name or email)
    if (type === "all" || type === "users") {
      const users = await User.find({
        $or: [
          { name: { $regex: searchQuery, $options: "i" } },
          { email: { $regex: searchQuery, $options: "i" } },
        ],
      })
        .select("_id name email avatar role employee_role")
        .limit(parseInt(limit))
        .lean();

      results.users = users.map((user) => ({
        ...user,
        type: "user",
        displayText: user.name,
        subText: user.email,
        route: `/dashboard/users`,
      }));
    }

    // Search Products (by name or SKU)
    if (type === "all" || type === "products") {
      const products = await Product.find({
        $or: [
          { name: { $regex: searchQuery, $options: "i" } },
          { sku: { $regex: searchQuery, $options: "i" } },
        ],
      })
        .select("_id name image price stock sku")
        .limit(parseInt(limit))
        .lean();

      results.products = products.map((product) => ({
        ...product,
        type: "product",
        displayText: product.name,
        subText: `SKU: ${product.sku || "N/A"} | Stock: ${product.stock}`,
        route: `/dashboard/products`,
      }));
    }

    // Search Orders (by order ID or user email)
    // Note: orderId is virtual (ORD-{last 6 chars of _id}), so we search by _id pattern
    if (type === "all" || type === "orders") {
      let orders = [];

      // Remove "ORD-" prefix if present and get the search term
      const orderSearchTerm = searchQuery.replace(/^ORD-/i, "").toUpperCase();

      if (orderSearchTerm.length >= 3) {
        // Get all orders and filter by _id suffix matching
        const allOrders = await Order.find()
          .populate("userId", "name email")
          .limit(100) // Get more to filter from
          .sort({ createdAt: -1 })
          .lean();

        orders = allOrders
          .filter((order) => {
            const orderIdSuffix = order._id.toString().slice(-6).toUpperCase();
            return orderIdSuffix.includes(orderSearchTerm);
          })
          .slice(0, parseInt(limit)); // Limit final results
      }

      results.orders = orders.map((order) => {
        const orderId = `ORD-${order._id.toString().slice(-6).toUpperCase()}`;
        const userEmail = order.userId?.email || "Unknown";
        return {
          ...order,
          orderId,
          type: "order",
          displayText: `Order #${orderId}`,
          subText: `${userEmail} - $${order.totalAmount || 0} - ${order.status}`,
          route: `/dashboard/orders`,
        };
      });
    }

    // Calculate total results
    results.total =
      results.users.length + results.products.length + results.orders.length;

    res.json(results);
  } catch (error) {
    console.error("Search error:", error);
    res.status(500);
    throw new Error("Search failed");
  }
});

export { globalSearch };
