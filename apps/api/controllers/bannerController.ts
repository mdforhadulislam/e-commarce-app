import { RequestHandler } from "express";
import asyncHandler from "express-async-handler";
import Banner from "../models/bannerModel.js";
import uploadService from "../config/uploadService.js";
import { PaginationQuery, RequestWithQuery, RequestWithBody } from "../types/express.js";

interface BannerQuery extends PaginationQuery {
  bannerType?: string;
}

interface BannerBody {
  name: string;
  title?: string;
  sale?: string;
  value?: string;
  image?: string;
  bannerType?: string;
  weight?: number;
}

interface BulkDeleteBody {
  ids: string[];
}

// @desc    Get all banners
// @route   GET /api/banners
// @access  Private
const getBanners: RequestHandler = asyncHandler(async (req, res) => {
  const banners = await Banner.find({}).sort({ weight: 1 });
  res.json(banners);
});

// @desc    Get all banners for admin with advanced filtering
// @route   GET /api/banners/admin
// @access  Private (Admin)
const getBannersAdmin: RequestHandler = asyncHandler(async (req: RequestWithQuery<BannerQuery>, res) => {
  const page = parseInt(req.query.page || "1");
  const perPage = parseInt(req.query.perPage || "10");
  const sortOrder = req.query.sortOrder || "asc";
  const search = req.query.search;
  const bannerType = req.query.bannerType;

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
  const filter: Record<string, any> = {};

  // Search filter
  if (search && search.trim()) {
    filter.$or = [
      { name: { $regex: search.trim(), $options: "i" } },
      { title: { $regex: search.trim(), $options: "i" } },
    ];
  }

  // Banner type filter
  if (bannerType && bannerType !== "all") {
    filter.bannerType = bannerType;
  }

  const skip = (page - 1) * perPage;
  const total = await Banner.countDocuments(filter);
  const sortValue = sortOrder === "asc" ? 1 : -1;

  const banners = await Banner.find(filter)
    .skip(skip)
    .limit(perPage)
    .sort(sortOrder === "asc" ? { weight: 1 } : { createdAt: -1 }); // Default to weight asc or create desc if requested

  const totalPages = Math.ceil(total / perPage);

  res.json({ banners, total, page, perPage, totalPages });
});

// @desc    Get banner by ID
// @route   GET /api/banners/:id
// @access  Private
const getBannerById: RequestHandler = asyncHandler(async (req, res) => {
  const banner = await Banner.findById(req.params.id);

  if (banner) {
    res.json(banner);
  } else {
    res.status(404);
    throw new Error("Banner not found");
  }
});

// @desc    Create a banner
// @route   POST /api/banners
// @access  Private/Admin
const createBanner: RequestHandler = asyncHandler(async (req: RequestWithBody<BannerBody>, res) => {
  const { name, title, sale, value, image, bannerType, weight } = req.body;

  let imageUrl = "";
  if (image) {
    const result = await uploadService.uploadImage(image, {
      folder: "banners",
      originalName: `banner_${name.replace(/\s+/g, "_").toLowerCase()}.jpg`,
    });
    imageUrl = result.url;
  }

  const banner = new Banner({
    name,
    title,
    sale,
    value,
    image: imageUrl || undefined,
    bannerType,
    weight: weight || 0,
  });

  const createdBanner = await banner.save();
  if (createdBanner) {
    res.status(201).json(createdBanner);
  } else {
    res.status(400);
    throw new Error("Invalid banner data");
  }
});

// @desc    Update a banner
// @route   PUT /api/banners/:id
// @access  Private/Admin
const updateBanner: RequestHandler = asyncHandler(async (req: RequestWithBody<BannerBody>, res) => {
  const { name, title, sale, value, image, bannerType, weight } = req.body;

  const banner = await Banner.findById(req.params.id);

  if (banner) {
    banner.name = name || banner.name;
    banner.title = title || banner.title;
    banner.sale = sale || banner.sale;
    banner.value = value || banner.value;
    banner.bannerType = bannerType || banner.bannerType;
    if (weight !== undefined) banner.weight = weight;

    try {
      if (image !== undefined) {
        if (image) {
          const result = await uploadService.replaceImage(image, banner.image, {
            folder: "banners",
            originalName: `banner_${(name || banner.name)
              .replace(/\s+/g, "_")
              .toLowerCase()}.jpg`,
          });
          banner.image = result.url;
        } else {
          // Delete old image if clearing the field
          if (banner.image) {
            try {
              await uploadService.deleteImage(banner.image);
            } catch (error) {
              console.error(
                `Failed to delete old banner image: ${(error as any).message}`
              );
            }
          }
          banner.image = undefined; // Clear image if empty string is provided
        }
      }
      const updatedBanner = await banner.save();
      res.json(updatedBanner);
    } catch (error) {
      if ((error as any).name === "ValidationError") {
        const errors = Object.values((error as any).errors).map((err: any) => err.message);
        res.status(400);
        throw new Error(errors.join(", "));
      }
      res.status(400);
      throw new Error("Invalid banner data");
    }
  } else {
    res.status(404);
    throw new Error("Banner not found");
  }
});

// @desc    Delete a banner
// @route   DELETE /api/banners/:id
// @access  Private/Admin
const deleteBanner: RequestHandler = asyncHandler(async (req, res) => {
  const banner = await Banner.findById(req.params.id);

  if (banner) {
    // Delete associated image before deleting the banner
    if (banner.image) {
      try {
        await uploadService.deleteImage(banner.image);
      } catch (error) {
        console.error(`Failed to delete banner image: ${(error as any).message}`);
        // Continue with banner deletion even if image deletion fails
      }
    }

    await banner.deleteOne();
    res.json({
      message: "Banner and associated image removed successfully",
      deletedImage: banner.image || null,
    });
  } else {
    res.status(404);
    throw new Error("Banner not found");
  }
});

// @desc    Bulk delete banners
// @route   POST /api/banners/bulk-delete
// @access  Private/Admin
const deleteBanners: RequestHandler = asyncHandler(async (req: RequestWithBody<BulkDeleteBody>, res) => {
  const { ids } = req.body;

  if (!ids || !Array.isArray(ids) || ids.length === 0) {
    res.status(400);
    throw new Error("No banner IDs provided");
  }

  // Find banners to delete to get their image paths
  const banners = await Banner.find({ _id: { $in: ids } });

  // Delete images from storage
  for (const banner of banners) {
    if (banner.image) {
      try {
        await uploadService.deleteImage(banner.image);
      } catch (error) {
        console.error(`Failed to delete banner image for ${banner._id}: ${(error as any).message}`);
      }
    }
  }

  // Delete banners from DB
  const result = await Banner.deleteMany({ _id: { $in: ids } });

  res.json({
    message: `${result.deletedCount} banners deleted successfully`,
  });
});

export {
  getBanners,
  getBannersAdmin,
  getBannerById,
  createBanner,
  updateBanner,
  deleteBanner,
  deleteBanners,
};
