import { Request, Response, NextFunction } from "express"; type RequestHandler = any;
import asyncHandler from "express-async-handler";
import Subscription from "../models/subscriptionModel.js";

const PREMIUM_MESSAGE = "This feature is only available in the premium version of the codebase.";

// @desc    Subscribe to newsletter
// @route   POST /api/subscriptions/subscribe
// @access  Public
export const subscribe: RequestHandler = asyncHandler(async (req, res) => {
  // Keep functional for storefront
  const { email, source = "other", preferences = {} } = req.body as any;

  if (!email) {
    res.status(400);
    throw new Error("Email is required");
  }

  // Email validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    res.status(400);
    throw new Error("Invalid email format");
  }

  const ipAddress = req.ip || req.connection.remoteAddress;
  const userAgent = req.get("user-agent");
  const existingSubscription = await Subscription.findOne({ email });

  if (existingSubscription) {
    if (existingSubscription.status === "active") {
      res.status(200).json({
        success: true,
        message: "You are already subscribed to our newsletter",
        subscription: {
          email: existingSubscription.email,
          subscribedAt: existingSubscription.subscribedAt,
        },
      });
      return;
    } else {
      existingSubscription.status = "active";
      existingSubscription.unsubscribedAt = null;
      existingSubscription.subscribedAt = new Date();
      existingSubscription.preferences = {
        ...existingSubscription.preferences,
        ...preferences,
      };
      await existingSubscription.save();

      res.status(200).json({
        success: true,
        message: "Welcome back! Your subscription has been reactivated",
        subscription: {
          email: existingSubscription.email,
          subscribedAt: existingSubscription.subscribedAt,
        },
      });
      return;
    }
  }

  const subscription = await Subscription.create({
    email,
    source,
    preferences: {
      newsletter: preferences.newsletter !== false,
      promotions: preferences.promotions !== false,
      newProducts: preferences.newProducts !== false,
    },
    ipAddress,
    userAgent,
  });

  res.status(201).json({
    success: true,
    message: "Successfully subscribed to our newsletter!",
    subscription: {
      email: subscription.email,
      subscribedAt: subscription.subscribedAt,
    },
  });
});

// @desc    Unsubscribe from newsletter
// @route   POST /api/subscriptions/unsubscribe
// @access  Public
export const unsubscribe: RequestHandler = asyncHandler(async (req, res) => {
  // Keep functional for storefront
  const { email } = req.body as any;

  if (!email) {
    res.status(400);
    throw new Error("Email is required");
  }

  const subscription = await Subscription.findOne({ email });

  if (!subscription) {
    res.status(404);
    throw new Error("Email not found in our subscription list");
  }

  if (subscription.status === "unsubscribed") {
    res.status(200).json({
      success: true,
      message: "You are already unsubscribed",
    });
    return;
  }

  subscription.status = "unsubscribed";
  subscription.unsubscribedAt = new Date();
  await subscription.save();

  res.status(200).json({
    success: true,
    message: "Successfully unsubscribed from newsletter",
  });
});

// @desc    Get all subscriptions (Admin only)
// @route   GET /api/subscriptions
// @access  Private/Admin
export const getSubscriptions: RequestHandler = asyncHandler(async (req, res) => {
  res.status(403).json({ success: false, message: PREMIUM_MESSAGE });
});

// @desc    Get subscription stats (Admin only)
// @route   GET /api/subscriptions/stats
// @access  Private/Admin
export const getSubscriptionStats: RequestHandler = asyncHandler(async (req, res) => {
  res.status(403).json({ success: false, message: PREMIUM_MESSAGE });
});

// @desc    Delete subscription (Admin only)
// @route   DELETE /api/subscriptions/:id
// @access  Private/Admin
export const deleteSubscription: RequestHandler = asyncHandler(async (req, res) => {
  res.status(403).json({ success: false, message: PREMIUM_MESSAGE });
});
