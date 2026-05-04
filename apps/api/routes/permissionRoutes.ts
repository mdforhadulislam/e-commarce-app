
import express, { Router } from "express";
import {
  getPermissions,
  createPermission,
  updatePermission,
  deletePermission,
} from "../controllers/permissionController.js";
import { protect, admin } from "../middleware/authMiddleware.js";

const router: Router = express.Router();

router.route("/")
  .get(protect, admin, getPermissions)
  .post(protect, admin, createPermission);

router.route("/:id")
  .put(protect, admin, updatePermission)
  .delete(protect, admin, deletePermission);

export default router;
