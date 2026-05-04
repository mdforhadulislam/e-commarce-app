import express, { Router } from "express";
import {
  getNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  deleteAllNotifications,
  createTestNotification,
  sendBulkNotification,
  getBulkSends,
  getUsersForNotification,
  getNotificationStats,
} from "../controllers/notificationController.js";
import { protect, admin } from "../middleware/authMiddleware.js";

const router: Router = express.Router();

// All routes require authentication
router.use(protect);

// User notification routes
router.get("/", getNotifications);
router.get("/unread-count", getUnreadCount);
router.put("/read-all", markAllAsRead);
router.put("/:id/read", markAsRead);
router.delete("/:id", deleteNotification);
router.delete("/", deleteAllNotifications);

// Test endpoint - create a test notification (development only)
router.post("/test", createTestNotification);

// Admin-only routes
router.post("/admin/bulk-send", admin, sendBulkNotification);
router.get("/admin/bulk-sends", admin, getBulkSends);
router.get("/admin/users", admin, getUsersForNotification);
router.get("/admin/stats", admin, getNotificationStats);

export default router;
