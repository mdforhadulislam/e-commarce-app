import { Request, Response, RequestHandler } from "express";
import asyncHandler from "express-async-handler";
import Contact from "../models/contactModel.js";

const PREMIUM_MESSAGE = "This feature is only available in the premium version of the codebase.";

// @desc    Create a new contact message
// @route   POST /api/contact
// @access  Public
const createContactMessage: RequestHandler = asyncHandler(
  async (req: Request, res: Response) => {
    // Keep this functional so the storefront contact page doesn't break for users
    const { name, email, subject, message } = req.body;

    if (!name || !email || !subject || !message) {
      res.status(400);
      throw new Error("Please provide all required fields");
    }

    const contact = await Contact.create({
      name,
      email,
      subject,
      message,
    });

    if (contact) {
      res.status(201).json({
        success: true,
        data: contact,
        message: "Message sent successfully",
      });
    } else {
      res.status(400);
      throw new Error("Invalid contact data");
    }
  },
);

// @desc    Get all contact messages
// @route   GET /api/contact
// @access  Private/Admin
const getContactMessages: RequestHandler = asyncHandler(
  async (req: Request, res: Response) => {
    res.status(403).json({ success: false, message: PREMIUM_MESSAGE });
  },
);

// @desc    Delete a contact message
// @route   DELETE /api/contact/:id
// @access  Private/Admin
const deleteContactMessage: RequestHandler = asyncHandler(
  async (req: Request, res: Response) => {
    res.status(403).json({ success: false, message: PREMIUM_MESSAGE });
  },
);

export { createContactMessage, getContactMessages, deleteContactMessage };
