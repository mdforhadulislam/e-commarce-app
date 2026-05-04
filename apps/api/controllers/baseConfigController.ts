import { RequestHandler } from "express";
import asyncHandler from "express-async-handler";
import BaseConfig from "../models/baseConfigModel.js";
import { RequestWithBody } from "../types/express.js";

interface BaseConfigBody {
  sidebar?: any;
  banner?: any;
  showAds?: boolean;
  showCategoryMenu?: boolean;
  revalidationTime?: number;
  search?: any;
  bottomHeader?: any;
}

// @desc    Get base configuration
// @route   GET /api/base-config
// @access  Public
const getBaseConfig: RequestHandler = asyncHandler(async (req, res) => {
  // Try to find the config, using lean() for performance since we don't need Mongoose document methods here
  let config = await BaseConfig.findOne().lean();

  if (!config) {
    // Create default config if it doesn't exist
    // We don't use lean() here because create() returns a document, but we can convert it to object
    const newConfig = await BaseConfig.create({});
    config = newConfig.toObject();
  }

  // Set Cache-Control header for better performance
  // Cache for 1 minute allowed, stale-while-revalidate for background updates
  res.set("Cache-Control", "public, max-age=60, stale-while-revalidate=30");

  res.json({
    success: true,
    data: config,
  });
});

// @desc    Update base configuration
// @route   PUT /api/base-config
// @access  Private/Admin
const updateBaseConfig: RequestHandler = asyncHandler(async (req: RequestWithBody<BaseConfigBody>, res) => {
  const { sidebar, banner, showAds, showCategoryMenu, revalidationTime, search, bottomHeader } = req.body;

  // Use findOneAndUpdate with upsert option for atomic operation
  // new: true - return the modified document
  // upsert: true - create if doesn't exist
  // runValidators: true - validate before update
  const config = await BaseConfig.findOneAndUpdate(
    {}, // Match first document (since it's a singleton)
    {
      $set: {
        ...(sidebar !== undefined && { sidebar }),
        ...(banner !== undefined && { banner }),
        ...(showAds !== undefined && { showAds }),
        ...(showCategoryMenu !== undefined && { showCategoryMenu }),
        ...(revalidationTime !== undefined && { revalidationTime }),
        ...(search !== undefined && { search }),
        ...(bottomHeader !== undefined && { bottomHeader }),
      },
    },
    {
      new: true,
      upsert: true,
      runValidators: true,
      setDefaultsOnInsert: true,
    }
  ).lean();

  res.json({
    success: true,
    message: "Base configuration updated successfully",
    data: config,
  });
});

export { getBaseConfig, updateBaseConfig };
