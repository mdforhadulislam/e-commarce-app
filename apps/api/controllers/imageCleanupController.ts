import { Request, Response, RequestHandler } from "express";
import asyncHandler from "express-async-handler";
import uploadService from "../config/uploadService.js";
import Product from "../models/productModel.js";
import Brand from "../models/brandModel.js";
import Category from "../models/categoryModel.js";
import Banner from "../models/bannerModel.js";
import User from "../models/userModel.js";
import { RequestWithBody } from "../types/express.js";

interface BulkDeleteBody {
  imageUrls: string[];
  provider?: string;
}

// @desc    Clean up orphaned images
// @route   POST /api/upload/cleanup
// @access  Private/Admin
const cleanupOrphanedImages: RequestHandler = asyncHandler(async (req: Request, res: Response) => {
  try {
    // Get all image URLs from database
    const products = await Product.find({}, "image");
    const brands = await Brand.find({}, "image");
    const categories = await Category.find({}, "image");
    const banners = await Banner.find({}, "image");
    const users = await User.find({}, "avatar");

    const databaseImages = [
      ...products.map((p) => p.image).filter(Boolean),
      ...brands.map((b) => b.image).filter(Boolean),
      ...categories.map((c) => c.image).filter(Boolean),
      ...banners.map((b) => b.image).filter(Boolean),
      ...users.map((u) => u.avatar).filter(Boolean),
    ];

    res.json({
      success: true,
      message: "Cleanup analysis completed",
      totalImagesInDatabase: databaseImages.length,
      imagesByType: {
        products: products.filter((p) => p.image).length,
        brands: brands.filter((b) => b.image).length,
        categories: categories.filter((c) => c.image).length,
        banners: banners.filter((b) => b.image).length,
        users: users.filter((u) => u.avatar).length,
      },
      note: "Manual cleanup required - compare with actual cloud storage contents",
    });
  } catch (error) {
    res.status(500);
    throw new Error(`Cleanup analysis failed: ${(error as any).message}`);
  }
});

// @desc    Bulk delete multiple images
// @route   DELETE /api/upload/bulk-delete
// @access  Private/Admin
const bulkDeleteImages: RequestHandler = asyncHandler(async (req: RequestWithBody<BulkDeleteBody>, res: Response) => {
  const { imageUrls, provider } = req.body;

  if (!imageUrls || !Array.isArray(imageUrls) || imageUrls.length === 0) {
    res.status(400);
    throw new Error("Array of image URLs is required");
  }

  const results = [];
  let successCount = 0;
  let failureCount = 0;

  for (const imageUrl of imageUrls) {
    try {
      const result = await uploadService.deleteImage(imageUrl, provider as "cloudinary" | "s3");
      results.push({
        url: imageUrl,
        success: true,
        result,
      });
      successCount++;
    } catch (error) {
      results.push({
        url: imageUrl,
        success: false,
        error: (error as any).message,
      });
      failureCount++;
    }
  }

  res.json({
    success: true,
    message: `Bulk delete completed: ${successCount} successful, ${failureCount} failed`,
    successCount,
    failureCount,
    total: imageUrls.length,
    results,
  });
});

export { cleanupOrphanedImages, bulkDeleteImages };
