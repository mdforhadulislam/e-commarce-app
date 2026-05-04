import express, { Router } from "express";
import {
  getProductTypes,
  getProductTypesAdmin,
  getProductTypeById,
  createProductType,
  updateProductType,
  deleteProductType,
} from "../controllers/productTypeController.js";
import { protect, admin } from "../middleware/authMiddleware.js";
import { preventReadOnlyActions } from "../middleware/readOnlyMiddleware.js";

const router: Router = express.Router();

router
  .route("/")
  .get(getProductTypes)
  .post(protect, admin, preventReadOnlyActions, createProductType);
router.route("/admin").get(protect, admin, getProductTypesAdmin);

router
  .route("/:id")
  .get(getProductTypeById)
  .put(protect, admin, preventReadOnlyActions, updateProductType)
  .delete(protect, admin, preventReadOnlyActions, deleteProductType);

export default router;
