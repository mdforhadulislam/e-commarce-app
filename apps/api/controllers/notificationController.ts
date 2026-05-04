import { RequestHandler } from "express";
import asyncHandler from "express-async-handler";
import {
  RequestWithQuery,
  RequestWithBody,
  PaginationQuery,
} from "../types/express.js";

const PREMIUM_MESSAGE = "This feature is only available in the premium version of the codebase.";

export const getNotifications: RequestHandler = asyncHandler(async (req, res) => {
  res.status(403).json({ success: false, message: PREMIUM_MESSAGE });
});

export const getUnreadCount: RequestHandler = asyncHandler(async (req, res) => {
  // Rather than breaking the UI pill count, just send 0
  res.status(200).json({ count: 0 });
});

export const markAsRead: RequestHandler = asyncHandler(async (req, res) => {
  res.status(403).json({ success: false, message: PREMIUM_MESSAGE });
});

export const markAllAsRead: RequestHandler = asyncHandler(async (req, res) => {
  res.status(403).json({ success: false, message: PREMIUM_MESSAGE });
});

export const deleteNotification: RequestHandler = asyncHandler(async (req, res) => {
  res.status(403).json({ success: false, message: PREMIUM_MESSAGE });
});

export const deleteAllNotifications: RequestHandler = asyncHandler(async (req, res) => {
  res.status(403).json({ success: false, message: PREMIUM_MESSAGE });
});

export const createTestNotification: RequestHandler = asyncHandler(async (req, res) => {
  res.status(403).json({ success: false, message: PREMIUM_MESSAGE });
});

// ============ ADMIN ENDPOINTS ============

export const sendBulkNotification: RequestHandler = asyncHandler(async (req, res) => {
  res.status(403).json({ success: false, message: PREMIUM_MESSAGE });
});

export const getBulkSends: RequestHandler = asyncHandler(async (req, res) => {
  res.status(403).json({ success: false, message: PREMIUM_MESSAGE });
});

export const getUsersForNotification: RequestHandler = asyncHandler(async (req, res) => {
  res.status(403).json({ success: false, message: PREMIUM_MESSAGE });
});

export const getNotificationStats: RequestHandler = asyncHandler(async (req, res) => {
  res.status(403).json({ success: false, message: PREMIUM_MESSAGE });
});
