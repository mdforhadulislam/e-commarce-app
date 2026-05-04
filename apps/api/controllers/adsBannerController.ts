import { RequestHandler } from "express";
import AdsBanner from "../models/adsBannerModel.js";
import asyncHandler from "express-async-handler";
import { PaginationQuery, RequestWithQuery, RequestWithBody } from "../types/express.js";
import uploadService from "../config/uploadService.js";
import mongoose from "mongoose";

interface AdsBannerQuery extends PaginationQuery {
  bannerType?: string;
  isActive?: string;
}

interface CreateAdsBannerBody {
  name: string;
  title?: string;
  description?: string;
  image: string;
  link?: string;
  bannerType: "advertisement" | "promotional" | "seasonal" | "offer";
  isActive?: boolean;
  order?: number;
}

// @desc    Get all ads banners with pagination
// @route   GET /api/ads-banners
// @access  Public
export const getAdsBanners: RequestHandler = asyncHandler(async (req: RequestWithQuery<AdsBannerQuery>, res) => {
  const page = Number(req.query.page) || 1;
  const perPage = Number(req.query.perPage) || 10;
  const bannerType = req.query.bannerType;
  const isActive = req.query.isActive;

  const query: Record<string, any> = {};

  if (bannerType) {
    query.bannerType = bannerType;
  }

  if (isActive !== undefined) {
    query.isActive = isActive === "true";
  }

  const count = await AdsBanner.countDocuments(query);
  const adsBanners = await AdsBanner.find(query)
    .sort({ order: 1, createdAt: -1 })
    .limit(perPage)
    .skip(perPage * (page - 1));

  res.json({
    adsBanners,
    page,
    perPage,
    totalPages: Math.ceil(count / perPage),
    total: count,
  });
});

// @desc    Get single ads banner
// @route   GET /api/ads-banners/:id
// @access  Public
export const getAdsBannerById: RequestHandler = asyncHandler(async (req, res) => {
  const adsBanner = await AdsBanner.findById(req.params.id);

  if (adsBanner) {
    res.json(adsBanner);
  } else {
    res.status(404);
    throw new Error("Ads banner not found");
  }
});

// @desc    Create new ads banner
// @route   POST /api/ads-banners
// @access  Private/Admin
export const createAdsBanner: RequestHandler = asyncHandler(async (req: RequestWithBody<CreateAdsBannerBody>, res) => {
  const { name, title, description, image, link, bannerType, isActive, order } =
    req.body;

  const adsBanner = await AdsBanner.create({
    name,
    title,
    description,
    image,
    link,
    bannerType,
    isActive,
    order,
  });

  res.status(201).json(adsBanner);
});

// @desc    Update ads banner
// @route   PUT /api/ads-banners/:id
// @access  Private/Admin
export const updateAdsBanner: RequestHandler = asyncHandler(async (req: RequestWithBody<Partial<CreateAdsBannerBody>>, res) => {
  const { name, title, description, image, link, bannerType, isActive, order } =
    req.body;

  const adsBanner = await AdsBanner.findById(req.params.id);

  if (adsBanner) {
    adsBanner.name = name || adsBanner.name;
    adsBanner.title = title || adsBanner.title;
    adsBanner.description =
      description !== undefined ? description : adsBanner.description;
    adsBanner.image = image || adsBanner.image;
    adsBanner.link = link !== undefined ? link : adsBanner.link;
    adsBanner.bannerType = bannerType || adsBanner.bannerType;
    adsBanner.isActive = isActive !== undefined ? isActive : adsBanner.isActive;
    adsBanner.order = order !== undefined ? order : adsBanner.order;

    const updatedAdsBanner = await adsBanner.save();
    res.json(updatedAdsBanner);
  } else {
    res.status(404);
    throw new Error("Ads banner not found");
  }
});

// @desc    Delete ads banner
// @route   DELETE /api/ads-banners/:id
// @access  Private/Admin
export const deleteAdsBanner: RequestHandler = asyncHandler(async (req, res) => {
  const adsBanner = await AdsBanner.findById(req.params.id);

  if (adsBanner) {
    if (adsBanner.image) {
      try {
        await uploadService.deleteImage(adsBanner.image);
      } catch (error) {
        console.error(`Failed to delete ads banner image: ${(error as any).message}`);
      }
    }

    await AdsBanner.deleteOne({ _id: req.params.id });
    res.json({ message: "Ads banner removed" });
  } else {
    res.status(404);
    throw new Error("Ads banner not found");
  }
});

// @desc    Toggle ads banner active status
// @route   PATCH /api/ads-banners/:id/toggle
// @access  Private/Admin
export const toggleAdsBannerStatus: RequestHandler = asyncHandler(async (req, res) => {
  const adsBanner = await AdsBanner.findById(req.params.id);

  if (adsBanner) {
    adsBanner.isActive = !adsBanner.isActive;
    const updatedAdsBanner = await adsBanner.save();
    res.json(updatedAdsBanner);
  } else {
    res.status(404);
    throw new Error("Ads banner not found");
  }
});

interface BulkDeleteBody {
  ids: string[];
}

// @desc    Bulk delete ads banners
// @route   POST /api/ads-banners/bulk-delete
// @access  Private/Admin
export const deleteAdsBanners: RequestHandler = asyncHandler(async (req: RequestWithBody<BulkDeleteBody>, res) => {
  const { ids } = req.body;

  if (!ids || !Array.isArray(ids) || ids.length === 0) {
    res.status(400);
    throw new Error("No ads banner IDs provided");
  }

  // Find ads banners to delete
  const adsBanners = await AdsBanner.find({ _id: { $in: ids } });

  // Delete images from storage
  for (const banner of adsBanners) {
    if (banner.image) {
      try {
        await uploadService.deleteImage(banner.image);
      } catch (error) {
        console.error(
          `Failed to delete ads banner image for ${banner._id}: ${(error as any).message}`
        );
      }
    }
  }

  const result = await AdsBanner.deleteMany({ _id: { $in: ids } });

  res.json({
    message: `${result.deletedCount} ads banners deleted successfully`,
  });
});
