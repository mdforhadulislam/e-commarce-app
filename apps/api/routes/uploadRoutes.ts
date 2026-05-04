import express, { Router } from "express";
import asyncHandler from "express-async-handler";
import uploadService from "../config/uploadService.js";
import { protect } from "../middleware/authMiddleware.js";
import {
  cleanupOrphanedImages,
  bulkDeleteImages,
} from "../controllers/imageCleanupController.js";

const router: Router = express.Router();

// @desc    Upload image with folder support
// @route   POST /api/upload
// @access  Private
const uploadImage = asyncHandler(async (req, res) => {
  const { image, folder } = req.body;

  if (!image) {
    res.status(400);
    throw new Error("Image data is required");
  }

  try {
    const result = await uploadService.uploadImage(image, {
      folder: folder || "babyshop",
      originalName: req.body.originalName || "upload.jpg",
    });

    res.json({
      success: true,
      url: result.url,
      publicId: result.publicId,
      provider: result.provider,
    });
  } catch (error) {
    res.status(500);
    throw new Error(`Upload failed: ${error.message}`);
  }
});

// @desc    Test upload service
// @route   POST /api/upload/test
// @access  Private/Admin
const testUpload = asyncHandler(async (req, res) => {
  const { image, provider, folder } = req.body;

  if (!image) {
    res.status(400);
    throw new Error("Image data is required");
  }

  try {
    const result = await uploadService.uploadImage(image, {
      provider: provider || undefined, // Will use default if not specified
      folder: folder || "test",
      originalName: "test_image.jpg",
    });

    res.json({
      success: true,
      result,
      stats: uploadService.getUploadStats(),
    });
  } catch (error) {
    res.status(500);
    throw new Error(`Upload test failed: ${error.message}`);
  }
});

// @desc    Get upload service stats
// @route   GET /api/upload/stats
// @access  Private/Admin
const getUploadStats = asyncHandler(async (req, res) => {
  const stats = uploadService.getUploadStats();
  res.json({
    success: true,
    stats,
  });
});

// @desc    Delete an uploaded image
// @route   DELETE /api/upload/delete
// @access  Private/Admin
const deleteUpload = asyncHandler(async (req, res) => {
  const { identifier, provider } = req.body;

  if (!identifier) {
    res.status(400);
    throw new Error("Image identifier (URL, key, or public ID) is required");
  }

  try {
    const result = await uploadService.deleteImage(identifier, provider);
    res.json({
      success: true,
      result,
    });
  } catch (error) {
    res.status(500);
    throw new Error(`Delete failed: ${error.message}`);
  }
});

// @desc    Generate presigned URL for S3 upload
// @route   POST /api/upload/presigned-url
// @access  Private/Admin
const generatePresignedUrl = asyncHandler(async (req, res) => {
  const { key, expiresIn } = req.body;

  if (!key) {
    res.status(400);
    throw new Error("S3 object key is required");
  }

  try {
    const signedUrl = await uploadService.generatePresignedUrl(key, expiresIn);
    res.json({
      success: true,
      signedUrl,
      expiresIn: expiresIn || 3600,
    });
  } catch (error) {
    res.status(500);
    throw new Error(`Presigned URL generation failed: ${error.message}`);
  }
});

// Routes
router.post("/", protect, uploadImage);
router.post("/test", testUpload);
router.get("/stats", getUploadStats);
router.delete("/delete", deleteUpload);
router.post("/presigned-url", generatePresignedUrl);
router.post("/cleanup", cleanupOrphanedImages);
router.delete("/bulk-delete", bulkDeleteImages);

export default router;
