import { RequestHandler } from "express";
import ProductBanner from "../models/productBannerModel.js";
import asyncHandler from "express-async-handler";
import {
  PaginationQuery,
  RequestWithQuery,
  RequestWithBody,
} from "../types/express.js";
import uploadService from "../config/uploadService.js";

interface ProductBannerQuery extends PaginationQuery {
  isActive?: string;
  search?: string;
}

interface CreateProductBannerBody {
  title: string;
  description?: string;
  image: string;
  buttonTitle?: string;
  buttonHref?: string;
  isActive?: boolean;
  order?: number;
  productType: string;
}

// @desc    Get all product banners with pagination for Admin
// @route   GET /api/product-banners/admin
// @access  Private/Admin
export const getAdminProductBanners: RequestHandler = asyncHandler(
  async (req: RequestWithQuery<ProductBannerQuery>, res) => {
    const page = Number(req.query.page) || 1;
    const perPage = Number(req.query.perPage) || 10;
    const isActive = req.query.isActive;
    const search = req.query.search;

    const query: Record<string, any> = {};

    if (isActive !== undefined) {
      query.isActive = isActive === "true";
    }

    if (search) {
      query.$or = [
        { title: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } },
      ];
    }

    const count = await ProductBanner.countDocuments(query);
    const productBanners = await ProductBanner.find(query)
      .populate("productType", "name type color")
      .sort({ order: 1, createdAt: -1 })
      .limit(perPage)
      .skip(perPage * (page - 1));

    res.json({
      productBanners,
      page,
      perPage,
      totalPages: Math.ceil(count / perPage),
      total: count,
    });
  },
);

// @desc    Get all active product banners for public display
// @route   GET /api/product-banners
// @access  Public
export const getActiveProductBanners: RequestHandler = asyncHandler(
  async (req, res) => {
    const productBanners = await ProductBanner.find({ isActive: true })
      .populate("productType", "name type color")
      .sort({
        order: 1,
        createdAt: -1,
      });

    res.json({
      productBanners,
    });
  },
);

// @desc    Get single product banner
// @route   GET /api/product-banners/:id
// @access  Public
export const getProductBannerById: RequestHandler = asyncHandler(
  async (req, res) => {
    const productBanner = await ProductBanner.findById(req.params.id).populate(
      "productType",
      "name type color",
    );

    if (productBanner) {
      res.json(productBanner);
    } else {
      res.status(404);
      throw new Error("Product banner not found");
    }
  },
);

// @desc    Create new product banner
// @route   POST /api/product-banners
// @access  Private/Admin
export const createProductBanner: RequestHandler = asyncHandler(
  async (req: RequestWithBody<CreateProductBannerBody>, res) => {
    const {
      title,
      description,
      image,
      buttonTitle,
      buttonHref,
      isActive,
      order,
      productType,
    } = req.body;

    if (buttonTitle && !buttonHref) {
      res.status(400);
      throw new Error("Button href is required when button title is provided");
    }

    const productBanner = await ProductBanner.create({
      title,
      description,
      image,
      buttonTitle,
      buttonHref,
      isActive,
      order,
      productType,
    });

    res.status(201).json(productBanner);
  },
);

// @desc    Update product banner
// @route   PUT /api/product-banners/:id
// @access  Private/Admin
export const updateProductBanner: RequestHandler = asyncHandler(
  async (req: RequestWithBody<Partial<CreateProductBannerBody>>, res) => {
    const {
      title,
      description,
      image,
      buttonTitle,
      buttonHref,
      isActive,
      order,
      productType,
    } = req.body;

    if (buttonTitle && !buttonHref) {
      res.status(400);
      throw new Error("Button href is required when button title is provided");
    }

    const productBanner = await ProductBanner.findById(req.params.id);

    if (productBanner) {
      productBanner.title = title || productBanner.title;
      productBanner.description =
        description !== undefined ? description : productBanner.description;
      productBanner.image = image || productBanner.image;
      productBanner.buttonTitle =
        buttonTitle !== undefined ? buttonTitle : productBanner.buttonTitle;
      productBanner.buttonHref =
        buttonHref !== undefined ? buttonHref : productBanner.buttonHref;
      productBanner.isActive =
        isActive !== undefined ? isActive : productBanner.isActive;
      productBanner.order = order !== undefined ? order : productBanner.order;
      if (productType !== undefined) {
        // @ts-ignore
        productBanner.productType = productType;
      }

      const updatedProductBanner = await productBanner.save();
      res.json(updatedProductBanner);
    } else {
      res.status(404);
      throw new Error("Product banner not found");
    }
  },
);

// @desc    Delete product banner
// @route   DELETE /api/product-banners/:id
// @access  Private/Admin
export const deleteProductBanner: RequestHandler = asyncHandler(
  async (req, res) => {
    const productBanner = await ProductBanner.findById(req.params.id);

    if (productBanner) {
      if (productBanner.image) {
        try {
          await uploadService.deleteImage(productBanner.image);
        } catch (error) {
          console.error(
            `Failed to delete product banner image: ${(error as any).message}`,
          );
        }
      }

      await ProductBanner.deleteOne({ _id: req.params.id });
      res.json({ message: "Product banner removed" });
    } else {
      res.status(404);
      throw new Error("Product banner not found");
    }
  },
);
