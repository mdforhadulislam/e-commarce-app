import { RequestHandler } from "express";
import asyncHandler from "express-async-handler";
import User from "../models/userModel.js";
import Product from "../models/productModel.js";
import mongoose from "mongoose";
import { PaginationQuery, RequestWithQuery, RequestWithBody } from "../types/express.js";

interface CartQuery extends PaginationQuery {
  // Inherits page, limit
}

interface CartItemBody {
  productId: string;
  quantity: number | string;
}

// @desc    Get user's cart
// @route   GET /api/cart
// @access  Private
export const getCart: RequestHandler = asyncHandler(async (req: RequestWithQuery<CartQuery>, res) => {
  const { page = "1", limit = "10" } = req.query;

  const user = await User.findById(req.user._id).populate({
    path: "cart.productId",
    model: "Product",
  });

  if (!user) {
    res.status(404);
    throw new Error("User not found");
  }

  // Filter out any cart items with null/deleted products
  const validCartItems = user.cart.filter((item) => item.productId);

  // Pagination logic
  const pageNumber = parseInt(page);
  const limitNumber = parseInt(limit);
  const skip = (pageNumber - 1) * limitNumber;
  const totalItems = validCartItems.length;
  const totalPages = Math.ceil(totalItems / limitNumber);

  // Get paginated items
  const paginatedItems = validCartItems.slice(skip, skip + limitNumber);

  res.json({
    success: true,
    cart: paginatedItems,
    pagination: {
      currentPage: pageNumber,
      totalPages,
      totalItems,
      hasMore: pageNumber < totalPages,
      limit: limitNumber,
    },
    message: "Cart retrieved successfully",
  });
});

// @desc    Add item to cart
// @route   POST /api/cart
// @access  Private
export const addItemToCart: RequestHandler = asyncHandler(async (req: RequestWithBody<CartItemBody>, res) => {
  const { productId, quantity = 1 } = req.body;
  const qty = typeof quantity === "string" ? parseInt(quantity) : quantity;

  if (!productId) {
    res.status(400);
    throw new Error("Product ID is required");
  }

  if (qty < 1) {
    res.status(400);
    throw new Error("Quantity must be at least 1");
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

  // Check if item already exists in cart
  const existingItemIndex = user.cart.findIndex(
    (item) => item.productId.toString() === productId
  );

  if (existingItemIndex > -1) {
    // Update quantity if item exists
    const newQuantity = user.cart[existingItemIndex].quantity + qty;

    // Check stock availability
    if (newQuantity > product.stock) {
      res.status(400);
      throw new Error(`Only ${product.stock} items available in stock`);
    }

    user.cart[existingItemIndex].quantity = newQuantity;
  } else {
    // Check stock availability for new item
    if (qty > product.stock) {
      res.status(400);
      throw new Error(`Only ${product.stock} items available in stock`);
    }

    // Add new item to cart
    user.cart.push({
      productId: new mongoose.Types.ObjectId(productId),
      quantity: qty,
    });
  }

  await user.save();

  // Populate the cart for response
  await user.populate({
    path: "cart.productId",
    model: "Product",
  });

  // Filter out any cart items with null/deleted products
  const validCartItems = user.cart.filter((item) => item.productId);

  res.json({
    success: true,
    cart: validCartItems,
    message: "Item added to cart successfully",
  });
});

// @desc    Update cart item quantity
// @route   PUT /api/cart
// @access  Private
export const updateCartItem: RequestHandler = asyncHandler(async (req: RequestWithBody<CartItemBody>, res) => {
  const { productId, quantity } = req.body;
  const qty = typeof quantity === "string" ? parseInt(quantity) : quantity;

  if (!productId) {
    res.status(400);
    throw new Error("Product ID is required");
  }

  if (qty < 0) {
    res.status(400);
    throw new Error("Quantity cannot be negative");
  }

  // Check if product exists and get stock
  const product = await Product.findById(productId);
  if (!product) {
    res.status(404);
    throw new Error("Product not found");
  }

  // Check stock availability if quantity > 0
  if (qty > 0 && qty > product.stock) {
    res.status(400);
    throw new Error(`Only ${product.stock} items available in stock`);
  }

  const user = await User.findById(req.user._id);
  if (!user) {
    res.status(404);
    throw new Error("User not found");
  }

  const itemIndex = user.cart.findIndex(
    (item) => item.productId.toString() === productId
  );

  if (itemIndex > -1) {
    if (qty === 0) {
      // Remove item if quantity is 0
      user.cart.splice(itemIndex, 1);
    } else {
      // Update quantity
      user.cart[itemIndex].quantity = qty;
    }
    await user.save();

    // Populate the cart for response
    await user.populate({
      path: "cart.productId",
      model: "Product",
    });

    // Filter out any cart items with null/deleted products
    const validCartItems = user.cart.filter((item) => item.productId);

    res.json({
      success: true,
      cart: validCartItems,
      message: "Cart item updated successfully",
    });
  } else {
    res.status(404);
    throw new Error("Item not found in cart");
  }
});

// @desc    Remove item from cart
// @route   DELETE /api/cart/:productId
// @access  Private
export const removeItemFromCart: RequestHandler = asyncHandler(async (req, res) => {
  const productId = req.params.productId;

  if (!productId) {
    res.status(400);
    throw new Error("Product ID is required");
  }

  const user = await User.findById(req.user._id);
  if (!user) {
    res.status(404);
    throw new Error("User not found");
  }

  const itemIndex = user.cart.findIndex(
    (item) => item.productId.toString() === productId
  );

  if (itemIndex > -1) {
    user.cart.splice(itemIndex, 1);
    await user.save();

    // Populate the cart for response
    await user.populate({
      path: "cart.productId",
      model: "Product",
    });

    // Filter out any cart items with null/deleted products
    const validCartItems = user.cart.filter((item) => item.productId);

    res.json({
      success: true,
      cart: validCartItems,
      message: "Item removed from cart successfully",
    });
  } else {
    res.status(404);
    throw new Error("Item not found in cart");
  }
});

// @desc    Clear cart
// @route   DELETE /api/cart
// @access  Private
export const clearCart: RequestHandler = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id);
  if (!user) {
    res.status(404);
    throw new Error("User not found");
  }

  user.cart = [];
  await user.save();

  res.json({
    success: true,
    cart: [],
    message: "Cart cleared successfully",
  });
});
