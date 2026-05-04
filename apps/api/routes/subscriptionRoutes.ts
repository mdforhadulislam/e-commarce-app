import express, { Router } from "express";
import {
  subscribe,
  unsubscribe,
  getSubscriptions,
  getSubscriptionStats,
  deleteSubscription,
} from "../controllers/subscriptionController.js";
import { protect, admin } from "../middleware/authMiddleware.js";

const router: Router = express.Router();

/**
 * @swagger
 * /api/subscriptions/subscribe:
 *   post:
 *     summary: Subscribe to newsletter
 *     tags: [Subscriptions]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               source:
 *                 type: string
 *                 enum: [homepage_modal, footer, popup, other]
 *               preferences:
 *                 type: object
 *                 properties:
 *                   newsletter:
 *                     type: boolean
 *                   promotions:
 *                     type: boolean
 *                   newProducts:
 *                     type: boolean
 *     responses:
 *       201:
 *         description: Successfully subscribed
 *       400:
 *         description: Invalid email or missing data
 */
router.post("/subscribe", subscribe);

/**
 * @swagger
 * /api/subscriptions/unsubscribe:
 *   post:
 *     summary: Unsubscribe from newsletter
 *     tags: [Subscriptions]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *     responses:
 *       200:
 *         description: Successfully unsubscribed
 *       404:
 *         description: Email not found
 */
router.post("/unsubscribe", unsubscribe);

/**
 * @swagger
 * /api/subscriptions:
 *   get:
 *     summary: Get all subscriptions (Admin only)
 *     tags: [Subscriptions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [active, unsubscribed]
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *     responses:
 *       200:
 *         description: List of subscriptions
 *       401:
 *         description: Unauthorized
 */
router.get("/", protect, admin, getSubscriptions);

/**
 * @swagger
 * /api/subscriptions/stats:
 *   get:
 *     summary: Get subscription statistics (Admin only)
 *     tags: [Subscriptions]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Subscription statistics
 *       401:
 *         description: Unauthorized
 */
router.get("/stats", protect, admin, getSubscriptionStats);

/**
 * @swagger
 * /api/subscriptions/{id}:
 *   delete:
 *     summary: Delete subscription (Admin only)
 *     tags: [Subscriptions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Subscription deleted
 *       404:
 *         description: Subscription not found
 */
router.delete("/:id", protect, admin, deleteSubscription);

export default router;
