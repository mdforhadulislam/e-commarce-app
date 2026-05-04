import express, { Router } from "express";
import {
  registerSeller,
  createSellerByAdmin,
  getSellerRequests,
  getSellerById,
  updateSellerStatus,
  updateSellerDetails,
  getMySellerStatus,
  getSellerConfig,
  updateSellerConfig,
  createSellerProduct,
  getSellerProducts,
  updateSellerProduct,
  deleteSellerProduct,
  getSellerDashboardStats,
  getApprovedSellers,
} from "../controllers/sellerController.js";
import { protect, admin } from "../middleware/authMiddleware.js";

const router: Router = express.Router();

router.route("/").post(protect, registerSeller);
router.route("/").get(protect, admin, getSellerRequests);
router.route("/create").post(protect, admin, createSellerByAdmin);
router.route("/requests").get(protect, admin, getSellerRequests);
router.route("/me").get(protect, getMySellerStatus);
router.route("/approved").get(getApprovedSellers); // Public endpoint to get approved sellers
router.route("/config").get(getSellerConfig); // Public endpoint to check seller system status
router.route("/config").put(protect, admin, updateSellerConfig); // Admin only for updates
// Seller Product Routes
router.route("/products").post(protect, createSellerProduct);
router.route("/products").get(protect, getSellerProducts);
router.route("/products/:id").put(protect, updateSellerProduct);
router.route("/products/:id").delete(protect, deleteSellerProduct);

// Seller Dashboard
router.route("/dashboard/stats").get(protect, getSellerDashboardStats);

// Dynamic ID routes (must come last to avoid capturing /products, /dashboard, etc.)
router.route("/:id/status").put(protect, admin, updateSellerStatus);
router
  .route("/:id")
  .get(protect, admin, getSellerById)
  .put(protect, admin, updateSellerDetails);

export default router;
