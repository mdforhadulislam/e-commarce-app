import express, { Router } from "express";
import {
  sendInvoice,
  sendGeneralEmail,
  testEmailConfig,
} from "../controllers/emailController.js";
import { protect, admin } from "../middleware/authMiddleware.js";

const router: Router = express.Router();

// All email routes require admin authentication
router.use(protect);
router.use(admin);

/**
 * @swagger
 * /api/email/invoice:
 *   post:
 *     summary: Send invoice via email
 *     tags: [Email]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - to
 *               - subject
 *               - message
 *               - invoiceHtml
 *             properties:
 *               to:
 *                 type: string
 *                 format: email
 *                 description: Recipient email address
 *               subject:
 *                 type: string
 *                 description: Email subject
 *               message:
 *                 type: string
 *                 description: Email message content
 *               invoiceHtml:
 *                 type: string
 *                 description: HTML content of the invoice
 *               invoiceNumber:
 *                 type: string
 *                 description: Invoice number for reference
 *     responses:
 *       200:
 *         description: Invoice email sent successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 messageId:
 *                   type: string
 *       400:
 *         description: Missing required fields
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Admin access required
 *       500:
 *         description: Failed to send email
 */
router.post("/invoice", sendInvoice);

/**
 * @swagger
 * /api/email/send:
 *   post:
 *     summary: Send general email
 *     tags: [Email]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - to
 *               - subject
 *               - message
 *             properties:
 *               to:
 *                 type: string
 *                 format: email
 *                 description: Recipient email address
 *               subject:
 *                 type: string
 *                 description: Email subject
 *               message:
 *                 type: string
 *                 description: Email message content
 *               html:
 *                 type: string
 *                 description: Optional HTML content
 *     responses:
 *       200:
 *         description: Email sent successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 messageId:
 *                   type: string
 *       400:
 *         description: Missing required fields
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Admin access required
 *       500:
 *         description: Failed to send email
 */
router.post("/send", sendGeneralEmail);

/**
 * @swagger
 * /api/email/test:
 *   get:
 *     summary: Test email configuration
 *     tags: [Email]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Test email sent successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 messageId:
 *                   type: string
 *                 sentTo:
 *                   type: string
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Admin access required
 *       500:
 *         description: Email configuration test failed
 */
router.get("/test", testEmailConfig);

export default router;
