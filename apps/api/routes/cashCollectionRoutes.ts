import express, { Router } from "express";
import {
  getMyCollections,
  getAccountsEmployees,
  submitToAccounts,
  getAccountsPendingSubmissions,
  getAccountsReceivedSubmissions,
  confirmCashReceipt,
  getAccountsStats,
  backfillCashCollections,
} from "../controllers/cashCollectionController.js";
import {
  protect,
  deliveryman,
  accounts,
  admin,
} from "../middleware/authMiddleware.js";

const router: Router = express.Router();

// All routes require authentication
router.use(protect);

// Admin routes
router.post("/backfill", admin, backfillCashCollections);

// Deliveryman routes
router.get("/my-collections", deliveryman, getMyCollections);
router.get("/accounts-employees", deliveryman, getAccountsEmployees);
router.put("/submit", deliveryman, submitToAccounts);

// Accounts routes
router.get("/accounts/pending", accounts, getAccountsPendingSubmissions);
router.get("/accounts/received", accounts, getAccountsReceivedSubmissions);
router.put("/accounts/confirm", accounts, confirmCashReceipt);
router.get("/accounts/stats", accounts, getAccountsStats);

export default router;
