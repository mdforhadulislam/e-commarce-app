import express, { Router } from "express";
import {
  getWebsiteIcons,
  getWebsiteIconByKey,
  createWebsiteIcon,
  updateWebsiteIcon,
  deleteWebsiteIcon,
  getIconsByCategory,
} from "../controllers/websiteIconController.js";
import { protect, admin } from "../middleware/authMiddleware.js";
import upload, { handleMulterError } from "../middleware/uploadMiddleware.js";

const router: Router = express.Router();

// Public routes
router.get("/", getWebsiteIcons);
router.get("/key/:key", getWebsiteIconByKey);
router.get("/category/:category", getIconsByCategory);

// Protected routes (Admin only)
router.post(
  "/",
  protect,
  admin,
  upload.single("image"),
  handleMulterError,
  createWebsiteIcon
);
router.put(
  "/:id",
  protect,
  admin,
  upload.single("image"),
  handleMulterError,
  updateWebsiteIcon
);
router.delete("/:id", protect, admin, deleteWebsiteIcon);

export default router;
