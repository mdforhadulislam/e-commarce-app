import express from "express";
import { protect, admin } from "../middleware/authMiddleware.js";
import {
  getProductBannerById,
  createProductBanner,
  updateProductBanner,
  deleteProductBanner,
  getAdminProductBanners,
  getActiveProductBanners,
} from "../controllers/productBannerController.js";

const router: express.Router = express.Router();

router
  .route("/")
  .get(getActiveProductBanners)
  .post(protect, admin, createProductBanner);
router.route("/admin").get(protect, admin, getAdminProductBanners);
router
  .route("/:id")
  .get(getProductBannerById)
  .put(protect, admin, updateProductBanner)
  .delete(protect, admin, deleteProductBanner);

export default router;
