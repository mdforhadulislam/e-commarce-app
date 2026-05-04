import express, { Router } from "express";
import {
  getUserAnalyticsOverview,
  getUserMonthlySpending,
  getUserOrderHistory,
  getUserProductPreferences,
} from "../controllers/userAnalyticsController.js";
import { protect } from "../middleware/authMiddleware.js";

const router: Router = express.Router();

// All user analytics routes require authentication (but not admin)
router.use(protect);

/**
 * @swagger
 * /api/user-analytics/overview:
 *   get:
 *     summary: Get user analytics overview
 *     tags: [User Analytics]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: User analytics overview retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     overview:
 *                       type: object
 *                       properties:
 *                         totalOrders:
 *                           type: number
 *                         completedOrders:
 *                           type: number
 *                         pendingOrders:
 *                           type: number
 *                         cancelledOrders:
 *                           type: number
 *                         totalSpent:
 *                           type: number
 *                         paidAmount:
 *                           type: number
 *                         avgOrderValue:
 *                           type: number
 *                         totalItems:
 *                           type: number
 *                     favoriteCategories:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           _id:
 *                             type: string
 *                           totalSpent:
 *                             type: number
 *                           itemCount:
 *                             type: number
 *                           orderCount:
 *                             type: number
 *                     spendingByStatus:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           _id:
 *                             type: string
 *                           totalAmount:
 *                             type: number
 *                           orderCount:
 *                             type: number
 *       401:
 *         description: Unauthorized
 */
router.get("/overview", getUserAnalyticsOverview);

/**
 * @swagger
 * /api/user-analytics/monthly-spending:
 *   get:
 *     summary: Get user monthly spending analytics
 *     tags: [User Analytics]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: months
 *         schema:
 *           type: integer
 *           default: 12
 *         description: Number of months to include in the analysis
 *     responses:
 *       200:
 *         description: User monthly spending analytics retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     monthlySpending:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           year:
 *                             type: number
 *                           month:
 *                             type: number
 *                           monthName:
 *                             type: string
 *                           totalSpent:
 *                             type: number
 *                           paidAmount:
 *                             type: number
 *                           orderCount:
 *                             type: number
 *                           completedOrders:
 *                             type: number
 *                           avgOrderValue:
 *                             type: number
 *                     period:
 *                       type: string
 *       401:
 *         description: Unauthorized
 */
router.get("/monthly-spending", getUserMonthlySpending);

/**
 * @swagger
 * /api/user-analytics/order-history:
 *   get:
 *     summary: Get user order history with analytics
 *     tags: [User Analytics]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *         description: Number of orders per page
 *     responses:
 *       200:
 *         description: User order history retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     orders:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           _id:
 *                             type: string
 *                           total:
 *                             type: number
 *                           status:
 *                             type: string
 *                           createdAt:
 *                             type: string
 *                             format: date-time
 *                           itemCount:
 *                             type: number
 *                           avgItemPrice:
 *                             type: number
 *                           deliveryTime:
 *                             type: number
 *                             nullable: true
 *                     pagination:
 *                       type: object
 *                       properties:
 *                         page:
 *                           type: number
 *                         limit:
 *                           type: number
 *                         total:
 *                           type: number
 *                         totalPages:
 *                           type: number
 *                         hasNextPage:
 *                           type: boolean
 *                         hasPrevPage:
 *                           type: boolean
 *       401:
 *         description: Unauthorized
 */
router.get("/order-history", getUserOrderHistory);

/**
 * @swagger
 * /api/user-analytics/product-preferences:
 *   get:
 *     summary: Get user product preferences analytics
 *     tags: [User Analytics]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: User product preferences retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     mostPurchasedProducts:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           _id:
 *                             type: string
 *                           productName:
 *                             type: string
 *                           productImage:
 *                             type: string
 *                           category:
 *                             type: string
 *                           totalQuantity:
 *                             type: number
 *                           totalSpent:
 *                             type: number
 *                           avgPrice:
 *                             type: number
 *                           orderCount:
 *                             type: number
 *                     spendingByCategory:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           _id:
 *                             type: string
 *                           totalSpent:
 *                             type: number
 *                           itemCount:
 *                             type: number
 *                           uniqueProductCount:
 *                             type: number
 *                           orderCount:
 *                             type: number
 *                     priceRangePreferences:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           range:
 *                             type: string
 *                           count:
 *                             type: number
 *                           totalSpent:
 *                             type: number
 *                           avgPrice:
 *                             type: number
 *       401:
 *         description: Unauthorized
 */
router.get("/product-preferences", getUserProductPreferences);

export default router;
