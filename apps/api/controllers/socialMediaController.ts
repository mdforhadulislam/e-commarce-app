// @ts-nocheck
import { Request, Response, NextFunction } from "express"; type RequestHandler = any;
import asyncHandler from "express-async-handler";
import SocialMedia from "../models/socialMediaModel.js";
import uploadService from "../config/uploadService.js";

// @desc    Get all active social media links (for public display)
// @route   GET /api/social-media
// @access  Public
const getSocialMediaLinks: RequestHandler = asyncHandler(async (req, res) => {
  const socialMedia = await SocialMedia.find({ isActive: true })
    .select("-apiKey -apiSecret -accessToken -webhookUrl") // Exclude sensitive data
    .sort({ displayOrder: 1 });

  res.json(socialMedia);
});

// @desc    Get all social media links for admin with advanced filtering
// @route   GET /api/social-media/admin
// @access  Private (Admin)
const getSocialMediaAdmin: RequestHandler = asyncHandler(async (req, res) => {
  const page = parseInt((req.query as any).page) || 1;
  const perPage = parseInt((req.query as any).perPage) || 10;
  const sortOrder = (req.query as any).sortOrder || "desc";
  const search = (req.query as any).search;
  const platform = (req.query as any).platform;

  // Validate page and perPage
  if (page < 1 || perPage < 1) {
    res.status(400);
    throw new Error("Page and perPage must be positive integers");
  }

  // Validate sortOrder
  if (!["asc", "desc"].includes(sortOrder)) {
    res.status(400);
    throw new Error('Sort order must be "asc" or "desc"');
  }

  // Build filter object
  const filter: any = {};

  // Search filter
  if (search && search.trim()) {
    filter.$or = [
      { name: { $regex: search.trim(), $options: "i" } },
      { platform: { $regex: search.trim(), $options: "i" } },
    ];
  }

  // Platform filter
  if (platform && platform !== "all") {
    filter.platform = platform;
  }

  const skip = (page - 1) * perPage;
  const total = await SocialMedia.countDocuments(filter);
  const sortValue = sortOrder === "asc" ? 1 : -1;

  const socialMedia = await SocialMedia.find(filter)
    .skip(skip)
    .limit(perPage)
    .sort({ createdAt: sortValue });

  const totalPages = Math.ceil(total / perPage);

  res.json({ socialMedia, total, page, perPage, totalPages });
});

// @desc    Get social media by ID
// @route   GET /api/social-media/:id
// @access  Private (Admin)
const getSocialMediaById: RequestHandler = asyncHandler(async (req, res) => {
  const socialMedia = await SocialMedia.findById(req.params.id);

  if (socialMedia) {
    res.json(socialMedia);
  } else {
    res.status(404);
    throw new Error("Social media not found");
  }
});

// @desc    Create a social media link
// @route   POST /api/social-media
// @access  Private/Admin
const createSocialMedia: RequestHandler = asyncHandler(async (req, res) => {
  const {
    name,
    platform,
    href,
    icon,
    displayOrder,
    isActive,
    apiKey,
    apiSecret,
    accessToken,
    webhookUrl,
    description,
  } = req.body as any;

  const socialMediaExists = await SocialMedia.findOne({ name });

  if (socialMediaExists) {
    res.status(400);
    throw new Error("Social media with this name already exists");
  }

  let iconUrl = "";
  if (icon) {
    const result = await uploadService.uploadImage(icon, {
      folder: "social-media",
      originalName: `social_${name.replace(/\s+/g, "_").toLowerCase()}.jpg`,
    });
    iconUrl = result.url;
  }

  const socialMedia = await SocialMedia.create({
    name,
    platform,
    href,
    icon: iconUrl || undefined,
    displayOrder: displayOrder || 0,
    isActive: isActive !== undefined ? isActive : true,
    apiKey: apiKey || undefined,
    apiSecret: apiSecret || undefined,
    accessToken: accessToken || undefined,
    webhookUrl: webhookUrl || undefined,
    description: description || undefined,
  });

  if (socialMedia) {
    res.status(201).json(socialMedia);
  } else {
    res.status(400);
    throw new Error("Invalid social media data");
  }
});

// @desc    Update a social media link
// @route   PUT /api/social-media/:id
// @access  Private/Admin
const updateSocialMedia: RequestHandler = asyncHandler(async (req, res) => {
  const {
    name,
    platform,
    href,
    icon,
    displayOrder,
    isActive,
    apiKey,
    apiSecret,
    accessToken,
    webhookUrl,
    description,
  } = req.body as any;

  const socialMedia = await SocialMedia.findById(req.params.id);

  if (socialMedia) {
    socialMedia.name = name || socialMedia.name;
    socialMedia.platform = platform || socialMedia.platform;
    socialMedia.href = href || socialMedia.href;
    socialMedia.displayOrder =
      displayOrder !== undefined ? displayOrder : socialMedia.displayOrder;
    socialMedia.isActive =
      isActive !== undefined ? isActive : socialMedia.isActive;
    socialMedia.apiKey = apiKey !== undefined ? apiKey : socialMedia.apiKey;
    socialMedia.apiSecret =
      apiSecret !== undefined ? apiSecret : socialMedia.apiSecret;
    socialMedia.accessToken =
      accessToken !== undefined ? accessToken : socialMedia.accessToken;
    socialMedia.webhookUrl =
      webhookUrl !== undefined ? webhookUrl : socialMedia.webhookUrl;
    socialMedia.description =
      description !== undefined ? description : socialMedia.description;

    if (icon !== undefined) {
      if (icon) {
        const result = await uploadService.replaceImage(
          icon,
          socialMedia.icon,
          {
            folder: "social-media",
            originalName: `social_${(name || socialMedia.name)
              .replace(/\s+/g, "_")
              .toLowerCase()}.jpg`,
          }
        );
        socialMedia.icon = result.url;
      } else {
        // Delete old icon if clearing the field
        if (socialMedia.icon) {
          try {
            await uploadService.deleteImage(socialMedia.icon);
          } catch (error) {
            console.error(
              `Failed to delete old social media icon: ${error.message}`
            );
          }
        }
        socialMedia.icon = undefined;
      }
    }

    const updatedSocialMedia = await socialMedia.save();
    res.json(updatedSocialMedia);
  } else {
    res.status(404);
    throw new Error("Social media not found");
  }
});

// @desc    Delete a social media link
// @route   DELETE /api/social-media/:id
// @access  Private/Admin
const deleteSocialMedia: RequestHandler = asyncHandler(async (req, res) => {
  const socialMedia = await SocialMedia.findById(req.params.id);

  if (socialMedia) {
    // Delete associated icon before deleting the social media
    if (socialMedia.icon) {
      try {
        await uploadService.deleteImage(socialMedia.icon);
        console.log(`Successfully deleted social media icon: ${socialMedia.icon}`);
      } catch (error) {
        console.error(`Failed to delete social media icon: ${error.message}`);
        // Continue with deletion even if icon deletion fails
      }
    }

    await socialMedia.deleteOne();
    res.json({
      message: "Social media and associated icon removed successfully",
      deletedIcon: socialMedia.icon || null,
    });
  } else {
    res.status(404);
    throw new Error("Social media not found");
  }
});

export {
  getSocialMediaLinks,
  getSocialMediaAdmin,
  getSocialMediaById,
  createSocialMedia,
  updateSocialMedia,
  deleteSocialMedia,
};
