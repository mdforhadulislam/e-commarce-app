// @ts-nocheck
import { Request, Response, NextFunction } from "express"; type RequestHandler = any;
import asyncHandler from "express-async-handler";
import User from "../models/userModel.js";
import Product from "../models/productModel.js";

// @desc    Get user's wishlist
// @route   GET /api/wishlist
// @access  Private
export const getUserWishlist: RequestHandler = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id).select("wishlist");

  if (!user) {
    res.status(404);
    throw new Error("User not found");
  }

  res.json({
    success: true,
    wishlist: user.wishlist || [],
  });
});

// @desc    Add product to wishlist
// @route   POST /api/wishlist/add
// @access  Private
export const addToWishlist: RequestHandler = asyncHandler(async (req, res) => {
  const { productId } = req.body as any;

  if (!productId) {
    res.status(400);
    throw new Error("Product ID is required");
  }

  // Check if product exists
  const product = await Product.findById(productId);
  if (!product) {
    res.status(404);
    throw new Error("Product not found");
  }

  const user = await User.findById(req.user._id);

  if (!user) {
    res.status(404);
    throw new Error("User not found");
  }

  // Check if product is already in wishlist
  if (user.wishlist.includes(productId)) {
    res.status(400);
    throw new Error("Product already in wishlist");
  }

  // Add product to wishlist
  user.wishlist.push(productId);
  await user.save();

  res.json({
    success: true,
    wishlist: user.wishlist,
    message: "Product added to wishlist",
  });
});

// @desc    Remove product from wishlist
// @route   DELETE /api/wishlist/remove
// @access  Private
export const removeFromWishlist: RequestHandler = asyncHandler(async (req, res) => {
  const { productId } = req.body as any;

  if (!productId) {
    res.status(400);
    throw new Error("Product ID is required");
  }

  const user = await User.findById(req.user._id);

  if (!user) {
    res.status(404);
    throw new Error("User not found");
  }

  // Remove product from wishlist
  user.wishlist = user.wishlist.filter(
    (id) => id.toString() !== productId.toString()
  );
  await user.save();

  res.json({
    success: true,
    wishlist: user.wishlist,
    message: "Product removed from wishlist",
  });
});

// @desc    Get wishlist products with details
// @route   POST /api/wishlist/products
// @access  Private
export const getWishlistProducts: RequestHandler = asyncHandler(async (req, res) => {
  const { productIds, page = 1, limit = 10 } = req.body as any;

  if (!productIds || !Array.isArray(productIds)) {
    res.status(400);
    throw new Error("Product IDs array is required");
  }

  const pageNumber = parseInt(page);
  const limitNumber = parseInt(limit);
  const skip = (pageNumber - 1) * limitNumber;

  // Get total count
  const totalProducts = productIds.length;
  const totalPages = Math.ceil(totalProducts / limitNumber);

  // Get paginated product IDs
  const paginatedIds = productIds.slice(skip, skip + limitNumber);

  // Get products by IDs
  const products = await Product.find({
    _id: { $in: paginatedIds },
  }).populate("category", "name");

  res.json({
    success: true,
    products,
    pagination: {
      currentPage: pageNumber,
      totalPages,
      totalProducts,
      hasMore: pageNumber < totalPages,
      limit: limitNumber,
    },
  });
});

// @desc    Clear entire wishlist
// @route   DELETE /api/wishlist/clear
// @access  Private
export const clearWishlist: RequestHandler = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id);

  if (!user) {
    res.status(404);
    throw new Error("User not found");
  }

  // Clear wishlist
  user.wishlist = [];
  await user.save();

  res.json({
    success: true,
    wishlist: [],
    message: "Wishlist cleared successfully",
  });
});
