import express, { Router } from "express";
import {
  getPurchases,
  getPurchaseById,
  createPurchaseRequisition,
  updatePurchaseStatus,
  updatePurchase,
  deletePurchase,
  getPurchaseStats,
} from "../controllers/purchaseController.js";
import { protect, admin } from "../middleware/authMiddleware.js";

const router: Router = express.Router();

// All routes require authentication and admin role
router.use(protect);
router.use(admin);

router.route("/").get(getPurchases).post(createPurchaseRequisition);

router.get("/stats", getPurchaseStats);

router
  .route("/:id")
  .get(getPurchaseById)
  .put(updatePurchase)
  .delete(deletePurchase);

router.put("/:id/status", updatePurchaseStatus);

export default router;
