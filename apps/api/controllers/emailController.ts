import { RequestHandler } from "express";
import asyncHandler from "express-async-handler";
import { sendInvoiceEmail, sendEmail } from "../utils/emailService.js";
import { RequestWithBody } from "../types/express.js";

interface InvoiceBody {
  to: string;
  subject: string;
  message: string;
  invoiceHtml: string;
  invoiceNumber: string;
}

interface GeneralEmailBody {
  to: string;
  subject: string;
  message: string;
  html?: string;
}

// @desc    Send invoice email
// @route   POST /api/email/invoice
// @access  Private/Admin
export const sendInvoice: RequestHandler = asyncHandler(
  async (req: RequestWithBody<InvoiceBody>, res) => {
    res.status(403).json({ 
      success: false, 
      message: "This feature is only available in the premium version of the codebase." 
    });
    return;
  },
);

// @desc    Send general email
// @route   POST /api/email/send
// @access  Private/Admin
export const sendGeneralEmail: RequestHandler = asyncHandler(
  async (req: RequestWithBody<GeneralEmailBody>, res) => {
    const { to, subject, message, html } = req.body;

    if (!to || !subject || !message) {
      res.status(400);
      throw new Error("Missing required fields: to, subject, message");
    }

    try {
      const result = await sendEmail({
        to,
        subject,
        message,
        html,
      });

      res.status(200).json({
        success: true,
        message: "Email sent successfully",
        messageId: result.messageId,
      });
    } catch (error) {
      res.status(500);
      throw new Error((error as any).message || "Failed to send email");
    }
  },
);

// @desc    Test email configuration
// @route   GET /api/email/test
// @access  Private/Admin
export const testEmailConfig: RequestHandler = asyncHandler(
  async (req, res) => {
    const testEmail = req.user.email;

    try {
      const result = await sendEmail({
        to: testEmail,
        subject: "Entry - Email Configuration Test",
        message:
          "This is a test email to verify your email configuration is working correctly.",
      });

      res.status(200).json({
        success: true,
        message: "Test email sent successfully",
        messageId: result.messageId,
        sentTo: testEmail,
      });
    } catch (error) {
      res.status(500);
      throw new Error(
        (error as any).message || "Email configuration test failed",
      );
    }
  },
);
