import express, { Router } from "express";
import {
  getSuppliers,
  getSupplierById,
  createSupplier,
  updateSupplier,
  deleteSupplier,
} from "../controllers/supplierController.js";
import { protect, admin } from "../middleware/authMiddleware.js";

const router: Router = express.Router();

router
  .route("/")
  .get(protect, admin, getSuppliers)
  .post(protect, admin, createSupplier);
router
  .route("/:id")
  .get(protect, admin, getSupplierById)
  .put(protect, admin, updateSupplier)
  .delete(protect, admin, deleteSupplier);

export default router;
