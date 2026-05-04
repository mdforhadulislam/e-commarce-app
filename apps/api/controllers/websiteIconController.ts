// @ts-nocheck
import { Request, Response, NextFunction } from "express"; type RequestHandler = any;
import WebsiteIcon from "../models/websiteIconModel.js";
import uploadService from "../config/uploadService.js";

// @desc    Get all website icons
// @route   GET /api/website-icons
// @access  Public
export const getWebsiteIcons = async (req, res) => {
  try {
    const { category, isActive } = req.query as any;

    const filter: any = {};
    if (category) filter.category = category;
    if (isActive !== undefined) filter.isActive = isActive === "true";

    const icons = await WebsiteIcon.find(filter).sort({
      category: 1,
      createdAt: -1,
    });

    res.json({
      success: true,
      data: icons,
      count: icons.length,
    });
  } catch (error) {
    console.error("Error fetching website icons:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching website icons",
      error: error.message,
    });
  }
};

// @desc    Get single website icon by key
// @route   GET /api/website-icons/:key
// @access  Public
export const getWebsiteIconByKey = async (req, res) => {
  try {
    const { key } = req.params;

    const icon = await WebsiteIcon.findOne({ key, isActive: true });

    if (!icon) {
      return res.status(404).json({
        success: false,
        message: "Website icon not found",
      });
    }

    res.json({
      success: true,
      data: icon,
    });
  } catch (error) {
    console.error("Error fetching website icon:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching website icon",
      error: error.message,
    });
  }
};

// @desc    Create website icon
// @route   POST /api/website-icons
// @access  Private/Admin
export const createWebsiteIcon = async (req, res) => {
  try {
    const { name, key, description, category, dimensions } = req.body as any;

    // Check if key already exists
    const existingIcon = await WebsiteIcon.findOne({ key });
    if (existingIcon) {
      return res.status(400).json({
        success: false,
        message: "An icon with this key already exists",
      });
    }

    // Handle image upload
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "Image file is required",
      });
    }

    // Upload to cloudinary using uploadService
    const result = await uploadService.uploadImage(req.file.buffer, {
      folder: "websiteIcons",
      originalName: `${key}.${req.file.originalname.split(".").pop()}`,
      contentType: req.file.mimetype,
    });

    const icon = await WebsiteIcon.create({
      name,
      key: key.toLowerCase().replace(/\s+/g, "_"),
      imageUrl: result.url,
      description,
      category,
      dimensions: dimensions ? JSON.parse(dimensions) : undefined,
    });

    res.status(201).json({
      success: true,
      message: "Website icon created successfully",
      data: icon,
    });
  } catch (error) {
    console.error("Error creating website icon:", error);
    res.status(500).json({
      success: false,
      message: "Error creating website icon",
      error: error.message,
    });
  }
};

// @desc    Update website icon
// @route   PUT /api/website-icons/:id
// @access  Private/Admin
export const updateWebsiteIcon = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, key, description, category, dimensions, isActive } = req.body as any;

    const icon = await WebsiteIcon.findById(id);

    if (!icon) {
      return res.status(404).json({
        success: false,
        message: "Website icon not found",
      });
    }

    // Check if new key already exists (if key is being changed)
    if (key && key !== icon.key) {
      const existingIcon = await WebsiteIcon.findOne({ key });
      if (existingIcon) {
        return res.status(400).json({
          success: false,
          message: "An icon with this key already exists",
        });
      }
    }

    // Handle image upload if new file is provided
    if (req.file) {
      // Replace image using uploadService (automatically deletes old image)
      const result = await uploadService.replaceImage(
        req.file.buffer,
        icon.imageUrl,
        {
          folder: "websiteIcons",
          originalName: `${key || icon.key}.${req.file.originalname.split(".").pop()}`,
          contentType: req.file.mimetype,
        }
      );

      icon.imageUrl = result.url;
    }

    // Update fields
    if (name) icon.name = name;
    if (key) icon.key = key.toLowerCase().replace(/\s+/g, "_");
    if (description !== undefined) icon.description = description;
    if (category) icon.category = category;
    if (dimensions) icon.dimensions = JSON.parse(dimensions);
    if (isActive !== undefined) icon.isActive = isActive;

    await icon.save();

    res.json({
      success: true,
      message: "Website icon updated successfully",
      data: icon,
    });
  } catch (error) {
    console.error("Error updating website icon:", error);
    res.status(500).json({
      success: false,
      message: "Error updating website icon",
      error: error.message,
    });
  }
};

// @desc    Delete website icon
// @route   DELETE /api/website-icons/:id
// @access  Private/Admin
export const deleteWebsiteIcon = async (req, res) => {
  try {
    const { id } = req.params;

    const icon = await WebsiteIcon.findById(id);

    if (!icon) {
      return res.status(404).json({
        success: false,
        message: "Website icon not found",
      });
    }

    // Delete image from cloudinary
    if (icon.imageUrl) {
      try {
        await uploadService.deleteImage(icon.imageUrl);
      } catch (err) {
        console.error("Error deleting image:", err);
      }
    }

    await icon.deleteOne();

    res.json({
      success: true,
      message: "Website icon deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting website icon:", error);
    res.status(500).json({
      success: false,
      message: "Error deleting website icon",
      error: error.message,
    });
  }
};

// @desc    Get icons by category
// @route   GET /api/website-icons/category/:category
// @access  Public
export const getIconsByCategory = async (req, res) => {
  try {
    const { category } = req.params;

    const icons = await WebsiteIcon.find({ category, isActive: true }).sort({
      createdAt: -1,
    });

    res.json({
      success: true,
      data: icons,
      count: icons.length,
    });
  } catch (error) {
    console.error("Error fetching icons by category:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching icons by category",
      error: error.message,
    });
  }
};
