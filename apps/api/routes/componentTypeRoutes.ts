import express, { Router } from "express";
import {
  getComponentTypes,
  getComponentTypeById,
  createComponentType,
  updateComponentType,
  deleteComponentType,
  toggleComponentTypeStatus,
} from "../controllers/componentTypeController.js";
import { protect, admin } from "../middleware/authMiddleware.js";

const router: Router = express.Router();

// Public routes
router.get("/", getComponentTypes);
router.get("/:id", getComponentTypeById);

// Admin routes
router.post("/", protect, admin, createComponentType);
router.put("/:id", protect, admin, updateComponentType);
router.delete("/:id", protect, admin, deleteComponentType);
router.patch("/:id/toggle", protect, admin, toggleComponentTypeStatus);

export default router;
