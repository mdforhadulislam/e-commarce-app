import express, { Router } from "express";
import {
  getAllAddresses,
  getUserAddresses,
} from "../controllers/addressController.js";
import { protect, admin } from "../middleware/authMiddleware.js";

const router: Router = express.Router();

// Admin only - Get all addresses
router.get("/", protect, admin, getAllAddresses);

// Get addresses for specific user
router.get("/user/:userId", protect, getUserAddresses);

export default router;
