import express, { Router } from "express";
import {
  getRoles,
  createRole,
  updateRole,
  deleteRole,
  getAvailablePermissions,
} from "../controllers/roleController.js";
import { protect, admin } from "../middleware/authMiddleware.js";
import { preventReadOnlyActions } from "../middleware/readOnlyMiddleware.js";

const router: Router = express.Router();

// All routes require authentication and admin privileges for now
router.use(protect);
router.use(admin);

router
  .route("/")
  .get(getRoles)
  .post(preventReadOnlyActions, createRole);

router.get("/permissions", getAvailablePermissions);

router
  .route("/:id")
  .put(preventReadOnlyActions, updateRole)
  .delete(preventReadOnlyActions, deleteRole);

export default router;
