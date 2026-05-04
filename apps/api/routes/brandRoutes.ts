import express, { Router } from "express";
import {
  getBrands,
  getBrandsAdmin,
  getBrandById,
  createBrand,
  updateBrand,
  deleteBrand,
  bulkDeleteBrands,
} from "../controllers/brandController.js";
import { protect, admin } from "../middleware/authMiddleware.js";
import { preventReadOnlyActions } from "../middleware/readOnlyMiddleware.js";

const router: Router = express.Router();

router
  .route("/")
  .get(getBrands)
  .post(protect, admin, preventReadOnlyActions, createBrand);
router.route("/admin").get(protect, admin, getBrandsAdmin);

router
  .route("/bulk-delete")
  .post(protect, admin, preventReadOnlyActions, bulkDeleteBrands);

router
  .route("/:id")
  .get(getBrandById)
  .put(protect, admin, preventReadOnlyActions, updateBrand)
  .delete(protect, admin, preventReadOnlyActions, deleteBrand);

export default router;
