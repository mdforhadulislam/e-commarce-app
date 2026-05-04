import { RequestHandler } from "express";
import asyncHandler from "express-async-handler";
import ProductType from "../models/productTypeModel.js";
import uploadService from "../config/uploadService.js";
import { RequestWithQuery, RequestWithBody, PaginationQuery } from "../types/express.js";

interface ProductTypeQuery extends PaginationQuery {
  isActive?: string;
  search?: string;
}

interface ProductTypeBody {
  name: string;
  type: string;
  description?: string;
  bannerImages?: string[];
  isActive?: boolean;
  displayOrder?: number;
  icon?: string;
  color?: string;
}

// @desc    Get all product types
// @route   GET /api/product-types
// @access  Public
const getProductTypes: RequestHandler = asyncHandler(async (req, res) => {
  const productTypes = await ProductType.find({ isActive: true }).sort({
    displayOrder: 1,
    createdAt: -1,
  });
  res.json(productTypes);
});

// @desc    Get all product types for admin with advanced filtering
// @route   GET /api/product-types/admin
// @access  Private (Admin)
const getProductTypesAdmin: RequestHandler = asyncHandler(async (req: RequestWithQuery<ProductTypeQuery>, res) => {
  const page = parseInt(req.query.page || "1");
  const perPage = parseInt(req.query.perPage || "10");
  const sortOrder = req.query.sortOrder || "desc";
  const search = req.query.search;
  const isActive = req.query.isActive;

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
      { type: { $regex: search.trim(), $options: "i" } },
      { description: { $regex: search.trim(), $options: "i" } },
    ];
  }

  // Active filter
  if (isActive !== undefined && isActive !== "") {
    filter.isActive = isActive === "true";
  }

  const skip = (page - 1) * perPage;
  const total = await ProductType.countDocuments(filter);
  const sortValue = sortOrder === "asc" ? 1 : -1;

  const productTypes = await ProductType.find(filter)
    .skip(skip)
    .limit(perPage)
    .sort({ createdAt: sortValue });

  const totalPages = Math.ceil(total / perPage);

  res.json({ productTypes, total, page, perPage, totalPages });
});

// @desc    Get product type by ID
// @route   GET /api/product-types/:id
// @access  Public
const getProductTypeById: RequestHandler = asyncHandler(async (req, res) => {
  const productType = await ProductType.findById(req.params.id);

  if (productType) {
    res.json(productType);
  } else {
    res.status(404);
    throw new Error("Product type not found");
  }
});

// @desc    Create a product type
// @route   POST /api/product-types
// @access  Private/Admin
const createProductType: RequestHandler = asyncHandler(async (req: RequestWithBody<ProductTypeBody>, res) => {
  const {
    name,
    type,
    description,
    bannerImages,
    isActive,
    displayOrder,
    icon,
    color,
  } = req.body;

  // Check if product type already exists
  const typeExists = await ProductType.findOne({
    $or: [{ name }, { type }],
  });

  if (typeExists) {
    res.status(400);
    throw new Error("Product type with this name or type already exists");
  }

  // Upload banner images if provided
  let uploadedBannerImages = [];
  if (bannerImages && Array.isArray(bannerImages) && bannerImages.length > 0) {
    for (const [index, image] of bannerImages.entries()) {
      const result = await uploadService.uploadImage(image, {
        folder: "product-types/banners",
        originalName: `${type}_banner_${index + 1}.jpg`,
      });
      uploadedBannerImages.push(result.url);
    }
  }

  // Upload icon if provided
  let iconUrl = "";
  if (icon) {
    const result = await uploadService.uploadImage(icon, {
      folder: "product-types/icons",
      originalName: `${type}_icon.jpg`,
    });
    iconUrl = result.url;
  }

  const productType = await ProductType.create({
    name,
    type,
    description: description || "",
    bannerImages: uploadedBannerImages,
    isActive: isActive !== undefined ? isActive : true,
    displayOrder: displayOrder || 0,
    icon: iconUrl,
    color: color || "#6B7280",
  });

  if (productType) {
    res.status(201).json(productType);
  } else {
    res.status(400);
    throw new Error("Invalid product type data");
  }
});

// @desc    Update a product type
// @route   PUT /api/product-types/:id
// @access  Private/Admin
const updateProductType: RequestHandler = asyncHandler(async (req: RequestWithBody<ProductTypeBody>, res) => {
  const {
    name,
    type,
    description,
    bannerImages,
    isActive,
    displayOrder,
    icon,
    color,
  } = req.body;

  const productType = await ProductType.findById(req.params.id);

  if (productType) {
    // Check if name or type is being changed and conflicts with another product type
    if (
      (name && name !== productType.name) ||
      (type && type !== productType.type)
    ) {
      const conflictingType = await ProductType.findOne({
        _id: { $ne: req.params.id },
        $or: [...(name ? [{ name }] : []), ...(type ? [{ type }] : [])],
      });

      if (conflictingType) {
        res.status(400);
        throw new Error("Product type with this name or type already exists");
      }
    }

    productType.name = name || productType.name;
    productType.type = type || productType.type;
    productType.description =
      description !== undefined ? description : productType.description;
    productType.isActive =
      isActive !== undefined ? isActive : productType.isActive;
    productType.displayOrder =
      displayOrder !== undefined ? displayOrder : productType.displayOrder;
    productType.color = color !== undefined ? color : productType.color;

    // Handle banner images update
    if (bannerImages !== undefined) {
      if (Array.isArray(bannerImages) && bannerImages.length > 0) {
        // Delete old banner images
        if (productType.bannerImages && productType.bannerImages.length > 0) {
          for (const oldImage of productType.bannerImages) {
            try {
              await uploadService.deleteImage(oldImage);
            } catch (error) {
              console.error(
                `Failed to delete old banner image: ${(error as any).message}`
              );
            }
          }
        }

        // Upload new banner images
        const uploadedBannerImages = [];
        for (const [index, image] of bannerImages.entries()) {
          const result = await uploadService.uploadImage(image, {
            folder: "product-types/banners",
            originalName: `${productType.type}_banner_${index + 1}.jpg`,
          });
          uploadedBannerImages.push(result.url);
        }
        productType.bannerImages = uploadedBannerImages;
      } else {
        // Clear banner images
        if (productType.bannerImages && productType.bannerImages.length > 0) {
          for (const oldImage of productType.bannerImages) {
            try {
              await uploadService.deleteImage(oldImage);
            } catch (error) {
              console.error(
                `Failed to delete old banner image: ${(error as any).message}`
              );
            }
          }
        }
        productType.bannerImages = [];
      }
    }

    // Handle icon update
    if (icon !== undefined) {
      if (icon) {
        const result = await uploadService.replaceImage(
          icon,
          productType.icon,
          {
            folder: "product-types/icons",
            originalName: `${productType.type}_icon.jpg`,
          }
        );
        productType.icon = result.url;
      } else {
        // Delete old icon
        if (productType.icon) {
          try {
            await uploadService.deleteImage(productType.icon);
          } catch (error) {
            console.error(`Failed to delete old icon: ${(error as any).message}`);
          }
        }
        productType.icon = "";
      }
    }

    const updatedProductType = await productType.save();
    res.json(updatedProductType);
  } else {
    res.status(404);
    throw new Error("Product type not found");
  }
});

// @desc    Delete a product type
// @route   DELETE /api/product-types/:id
// @access  Private/Admin
const deleteProductType: RequestHandler = asyncHandler(async (req, res) => {
  const productType = await ProductType.findById(req.params.id);

  if (productType) {
    // Delete associated banner images
    if (productType.bannerImages && productType.bannerImages.length > 0) {
      for (const image of productType.bannerImages) {
        try {
          await uploadService.deleteImage(image);
        } catch (error) {
          console.error(`Failed to delete banner image: ${(error as any).message}`);
        }
      }
    }

    // Delete associated icon
    if (productType.icon) {
      try {
        await uploadService.deleteImage(productType.icon);
      } catch (error) {
        console.error(`Failed to delete icon: ${(error as any).message}`);
      }
    }

    await productType.deleteOne();
    res.json({
      message: "Product type and associated images removed successfully",
    });
  } else {
    res.status(404);
    throw new Error("Product type not found");
  }
});

export {
  getProductTypes,
  getProductTypesAdmin,
  getProductTypeById,
  createProductType,
  updateProductType,
  deleteProductType,
};
