import { Request, Response, NextFunction } from "express"; type RequestHandler = any;
import asyncHandler from "express-async-handler";

const PREMIUM_MESSAGE = "This feature is only available in the premium version of the codebase.";

export const getSuppliers: RequestHandler = asyncHandler(async (req, res) => {
  res.status(403).json({ success: false, message: PREMIUM_MESSAGE });
});

export const getSupplierById: RequestHandler = asyncHandler(async (req, res) => {
  res.status(403).json({ success: false, message: PREMIUM_MESSAGE });
});

export const createSupplier: RequestHandler = asyncHandler(async (req, res) => {
  res.status(403).json({ success: false, message: PREMIUM_MESSAGE });
});

export const updateSupplier: RequestHandler = asyncHandler(async (req, res) => {
  res.status(403).json({ success: false, message: PREMIUM_MESSAGE });
});

export const deleteSupplier: RequestHandler = asyncHandler(async (req, res) => {
  res.status(403).json({ success: false, message: PREMIUM_MESSAGE });
});
