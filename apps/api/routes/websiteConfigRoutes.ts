import express, { Router } from "express";
import {
  getWebsiteConfigs,
  getConfigsByPageType,
  getWebsiteConfigById,
  createWebsiteConfig,
  updateWebsiteConfig,
  deleteWebsiteConfig,
  reorderWebsiteConfigs,
  toggleConfigStatus,
} from "../controllers/websiteConfigController.js";
import { protect, admin } from "../middleware/authMiddleware.js";

const router: Router = express.Router();

// Public routes
router.get("/page/:pageType", getConfigsByPageType);

// Protected admin routes
router.use(protect);
router.use(admin);

router.route("/").get(getWebsiteConfigs).post(createWebsiteConfig);

router.put("/reorder", reorderWebsiteConfigs);

router
  .route("/:id")
  .get(getWebsiteConfigById)
  .put(updateWebsiteConfig)
  .delete(deleteWebsiteConfig);

router.patch("/:id/toggle", toggleConfigStatus);

export default router;
