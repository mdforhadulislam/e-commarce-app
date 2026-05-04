import { Request, Response, NextFunction } from "express"; type RequestHandler = any;
import asyncHandler from "express-async-handler";

const PREMIUM_MESSAGE = "This feature is only available in the premium version of the codebase.";

export const getPurchases: RequestHandler = asyncHandler(async (req, res) => {
  res.status(403).json({ success: false, message: PREMIUM_MESSAGE });
});

export const getPurchaseById: RequestHandler = asyncHandler(async (req, res) => {
  res.status(403).json({ success: false, message: PREMIUM_MESSAGE });
});

export const createPurchaseRequisition: RequestHandler = asyncHandler(async (req, res) => {
  res.status(403).json({ success: false, message: PREMIUM_MESSAGE });
});

export const updatePurchaseStatus: RequestHandler = asyncHandler(async (req, res) => {
  res.status(403).json({ success: false, message: PREMIUM_MESSAGE });
});

export const updatePurchase: RequestHandler = asyncHandler(async (req, res) => {
  res.status(403).json({ success: false, message: PREMIUM_MESSAGE });
});

export const deletePurchase: RequestHandler = asyncHandler(async (req, res) => {
  res.status(403).json({ success: false, message: PREMIUM_MESSAGE });
});

export const getPurchaseStats: RequestHandler = asyncHandler(async (req, res) => {
  res.status(403).json({ success: false, message: PREMIUM_MESSAGE });
});
