import express, { Router } from "express";
import {
  getAdsBanners,
  getAdsBannerById,
  createAdsBanner,
  updateAdsBanner,
  deleteAdsBanner,
  toggleAdsBannerStatus,
  deleteAdsBanners,
} from "../controllers/adsBannerController.js";
import { protect, admin } from "../middleware/authMiddleware.js";
import { preventReadOnlyActions } from "../middleware/readOnlyMiddleware.js";

const router: Router = express.Router();

// Public routes
router.route("/").get(getAdsBanners);
router.route("/:id").get(getAdsBannerById);

// Protected admin routes
router.use(protect);
router.use(admin);

router.post("/bulk-delete", preventReadOnlyActions, deleteAdsBanners);
router.route("/").post(preventReadOnlyActions, createAdsBanner);
router
  .route("/:id")
  .put(preventReadOnlyActions, updateAdsBanner)
  .delete(preventReadOnlyActions, deleteAdsBanner);
router.patch("/:id/toggle", preventReadOnlyActions, toggleAdsBannerStatus);

export default router;
