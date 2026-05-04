import { RequestHandler } from "express";
import asyncHandler from "express-async-handler";
import Brand from "../models/brandModel.js";
import uploadService from "../config/uploadService.js";
import { PaginationQuery, RequestWithQuery, RequestWithBody } from "../types/express.js";
// import { FilterQuery } from "mongoose";

interface BrandQuery extends PaginationQuery {
  // Inherits default pagination query params
}

interface BrandBody {
  name: string;
  image?: string;
}

// @desc    Get all brands
// @route   GET /api/brands
// @access  Private
const getBrands: RequestHandler = asyncHandler(async (req, res) => {
  const brands = await Brand.find({});
  res.json(brands);
});

// @desc    Get all brands for admin with advanced filtering
// @route   GET /api/brands/admin
// @access  Private (Admin)
const getBrandsAdmin: RequestHandler = asyncHandler(async (req: RequestWithQuery<BrandQuery>, res) => {
  const page = parseInt(req.query.page || "1");
  const perPage = parseInt(req.query.perPage || "10");
  const sortOrder = req.query.sortOrder || "desc";
  const search = req.query.search;

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
    filter.name = { $regex: search.trim(), $options: "i" };
  }

  const skip = (page - 1) * perPage;
  const total = await Brand.countDocuments(filter);
  const sortValue = sortOrder === "asc" ? 1 : -1;

  const brands = await Brand.find(filter)
    .skip(skip)
    .limit(perPage)
    .sort({ createdAt: sortValue });

  const totalPages = Math.ceil(total / perPage);

  res.json({ brands, total, page, perPage, totalPages });
});

// @desc    Get brand by ID
// @route   GET /api/brands/:id
// @access  Private
const getBrandById: RequestHandler = asyncHandler(async (req, res) => {
  const brand = await Brand.findById(req.params.id);

  if (brand) {
    res.json(brand);
  } else {
    res.status(404);
    throw new Error("Brand not found");
  }
});

// @desc    Create a brand
// @route   POST /api/brands
// @access  Private/Admin
const createBrand: RequestHandler = asyncHandler(async (req: RequestWithBody<BrandBody>, res) => {
  const { name, image } = req.body;

  const brandExists = await Brand.findOne({ name });

  if (brandExists) {
    res.status(400);
    throw new Error("Brand already exists");
  }

  let imageUrl = "";
  if (image) {
    const result = await uploadService.uploadImage(image, {
      folder: "brands",
      originalName: `brand_${name.replace(/\s+/g, "_").toLowerCase()}.jpg`,
    });
    imageUrl = result.url;
  }

  const brand = await Brand.create({
    name,
    image: imageUrl || undefined, // Store image URL if provided, else undefined
  });

  if (brand) {
    res.status(201).json(brand);
  } else {
    res.status(400);
    throw new Error("Invalid brand data");
  }
});

// @desc    Update a brand
// @route   PUT /api/brands/:id
// @access  Private/Admin
const updateBrand: RequestHandler = asyncHandler(async (req: RequestWithBody<BrandBody>, res) => {
  const { name, image } = req.body;

  const brand = await Brand.findById(req.params.id);

  if (brand) {
    brand.name = name || brand.name;

    if (image !== undefined) {
      if (image) {
        const result = await uploadService.replaceImage(image, brand.image, {
          folder: "brands",
          originalName: `brand_${(name || brand.name)
            .replace(/\s+/g, "_")
            .toLowerCase()}.jpg`,
        });
        brand.image = result.url;
      } else {
        // Delete old image if clearing the field
        if (brand.image) {
          try {
            await uploadService.deleteImage(brand.image);
          } catch (error) {
            console.error(`Failed to delete old brand image: ${(error as any).message}`);
          }
        }
        brand.image = undefined; // Clear image if empty string is provided
      }
    }

    const updatedBrand = await brand.save();
    res.json(updatedBrand);
  } else {
    res.status(404);
    throw new Error("Brand not found");
  }
});

// @desc    Delete a brand
// @route   DELETE /api/brands/:id
// @access  Private/Admin
const deleteBrand: RequestHandler = asyncHandler(async (req, res) => {
  const brand = await Brand.findById(req.params.id);

  if (brand) {
    // Delete associated image before deleting the brand
    if (brand.image) {
      try {
        await uploadService.deleteImage(brand.image);
      } catch (error) {
        console.error(`Failed to delete brand image: ${(error as any).message}`);
        // Continue with brand deletion even if image deletion fails
      }
    }

    await brand.deleteOne();
    res.json({
      message: "Brand and associated image removed successfully",
      deletedImage: brand.image || null,
    });
  } else {
    res.status(404);
    throw new Error("Brand not found");
  }
});

// @desc    Bulk delete brands
// @route   POST /api/brands/bulk-delete
// @access  Private/Admin
const bulkDeleteBrands: RequestHandler = asyncHandler(async (req, res) => {
  const { brandIds } = req.body;

  if (!brandIds || !Array.isArray(brandIds) || brandIds.length === 0) {
    res.status(400);
    throw new Error("Brand IDs array is required");
  }

  const results = {
    successful: [] as string[],
    failed: [] as { id: string; name: string; reason: string }[],
  };

  for (const id of brandIds) {
    const brand = await Brand.findById(id);

    if (!brand) {
      results.failed.push({
        id,
        name: "Unknown",
        reason: "Brand not found",
      });
      continue;
    }

    try {
      // Delete associated image before deleting the brand
      if (brand.image) {
        await uploadService.deleteImage(brand.image).catch((err) => {
          console.error(`Failed to delete image for brand ${brand.name}:`, err);
        });
      }

      await brand.deleteOne();
      results.successful.push(id);
    } catch (error) {
      results.failed.push({
        id,
        name: brand.name,
        reason: (error as any).message,
      });
    }
  }

  res.json({
    message: `Processed ${brandIds.length} brands`,
    results,
  });
});

export {
  getBrands,
  getBrandsAdmin,
  getBrandById,
  createBrand,
  updateBrand,
  deleteBrand,
  bulkDeleteBrands,
};
