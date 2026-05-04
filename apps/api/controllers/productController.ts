import { Request, Response, RequestHandler } from "express";
import asyncHandler from "express-async-handler";
import Product from "../models/productModel.js";
import ProductType from "../models/productTypeModel.js";
import uploadService from "../config/uploadService.js";
import {
  extractDominantColors,
  extractColorsFromUrl,
  calculateColorSimilarity,
} from "../utils/imageMatching.js";
import { getCachedProductColors } from "../utils/imageCache.js";
import {
  RequestWithQuery,
  RequestWithBody,
  PaginationQuery,
} from "../types/express.js";

interface ProductQuery extends PaginationQuery {
  category?: string;
  brand?: string;
  priceMin?: string;
  priceMax?: string;
  search?: string;
  productType?: string;
  excludeProductType?: string;
  seller?: string;
  approvalStatus?: string;
}

interface ProductBody {
  name: string;
  description: string;
  price: number;
  category: string;
  brand: string;
  image?: string;
  images?: string[];
  discountPercentage?: number;
  stock?: number;
  productType?: string[];
  aboutItems?: string[];
}

interface RatingBody {
  rating: number;
}


interface ApproveProductBody {
  approve?: boolean;
  approvalStatus?: string;
}

interface BulkCreateBody {
  products: ProductBody[];
}

// @desc    Get all products with pagination, sorting, and filtering
// @route   GET /api/products?page=<page>&limit=<limit>&sortOrder=<asc|desc>&category=<categoryId>&priceMin=<min>&priceMax=<max>
// @access  Public
const getProducts: RequestHandler = asyncHandler(
  async (req: RequestWithQuery<ProductQuery>, res) => {
    const {
      page = "1",
      limit,
      perPage,
      sortOrder = "asc",
      category,
      brand,
      priceMin,
      priceMax,
      search,
      productType,
      excludeProductType,
      seller,
      approvalStatus,
    } = req.query;

    // Use perPage if provided, otherwise use limit, default to 10
    const itemsPerPage = perPage || limit || "10";

    // Validate page and limit
    const pageNumber = parseInt(page);
    const limitNumber = parseInt(itemsPerPage);
    if (pageNumber < 1 || limitNumber < 1) {
      res.status(400);
      throw new Error("Page and limit must be positive integers");
    }

    // Validate sortOrder
    if (!["asc", "desc"].includes(sortOrder)) {
      res.status(400);
      throw new Error('Sort order must be "asc" or "desc"');
    }

    // Build query
    const query: any = {};

    // Handle approval status filter
    if (approvalStatus) {
      query.approvalStatus = approvalStatus;
    } else {
      // Default: Show products that are either approved OR don't have approvalStatus field (legacy/admin products)
      // Only hide pending and rejected seller products
      query.$or = [
        { approvalStatus: "approved" },
        { approvalStatus: { $exists: false } },
        { approvalStatus: null },
      ];
    }

    if (category) query.category = category;
    if (brand) query.brand = brand;

    // Handle productType filter - lookup ProductType by type field to get ObjectId
    if (productType) {
      const productTypeDoc = await ProductType.findOne({ type: productType });
      if (productTypeDoc) {
        query.productType = productTypeDoc._id;
      }
    }

    if (excludeProductType) {
      const excludeProductTypeDoc = await ProductType.findOne({
        type: excludeProductType,
      });
      if (excludeProductTypeDoc) {
        query.productType = { $ne: excludeProductTypeDoc._id };
      }
    }

    // Handle seller filter
    if (seller === "no-seller") {
      // Filter to show only admin products (no seller)
      query.seller = { $in: [null, undefined] };
    } else if (seller === "seller-products") {
      // Filter to show all seller products (any seller)
      query.seller = { $exists: true, $ne: null };
    } else if (seller) {
      // Filter to specific seller ID
      query.seller = seller;
    }

    if (priceMin || priceMax) {
      query.price = {};
      if (priceMin) query.price.$gte = Number(priceMin);
      if (priceMax) {
        query.price.$lte =
          Number(priceMax) === Infinity
            ? Number.MAX_SAFE_INTEGER
            : Number(priceMax);
      }
    }

    if (search) {
      query.name = { $regex: search, $options: "i" }; // Case-insensitive search
    }

    // Pagination
    const skip = (pageNumber - 1) * limitNumber;

    // Fetch products and total count
    const sortValue = sortOrder === "asc" ? 1 : -1;
    const [products, total] = await Promise.all([
      Product.find(query)
        .populate("category", "name")
        .populate("brand", "name")
        .populate("seller", "storeName")
        .populate("productType", "name type color displayOrder")
        .skip(skip)
        .limit(limitNumber)
        .sort({ createdAt: sortValue }),
      Product.countDocuments(query),
    ]);

    res.json({
      products,
      total,
    });
  },
);

// @desc    Get product by ID
// @route   GET /api/products/:id
// @access  Private
const getProductById: RequestHandler = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const productId = Array.isArray(id) ? id[0] : id;
  let product;

  // Check if it's a valid MongoDB ObjectId
  const isValidObjectId = /^[0-9a-fA-F]{24}$/.test(productId);

  if (isValidObjectId) {
    // Try to find by ID first
    product = await Product.findById(productId)
      .populate("category", "name")
      .populate("brand", "name")
      .populate("productType", "name type color displayOrder");
  }

  // If not found by ID or not a valid ObjectId, try to find by slug
  if (!product) {
    product = await Product.findOne({ slug: productId })
      .populate("category", "name")
      .populate("brand", "name")
      .populate("productType", "name type color displayOrder");
  }

  if (product) {
    res.json(product);
  } else {
    res.status(404);
    throw new Error("Product not found");
  }
});

// @desc    Create a product
// @route   POST /api/products
// @access  Private/Admin
const createProduct: RequestHandler = asyncHandler(
  async (req: RequestWithBody<ProductBody>, res) => {
    const {
      name,
      description,
      price,
      category,
      brand,
      image,
      images,
      discountPercentage,
      stock,
      productType,
      aboutItems,
    } = req.body;

    // Check if product with same name exists
    const productExists = await Product.findOne({ name });
    if (productExists) {
      res.status(400);
      throw new Error("Product with this name already exists");
    }

    // Get max images from environment or default to 5
    const maxImages = parseInt(process.env.MAX_PRODUCT_IMAGES || "5");

    // Handle images array if provided, otherwise use single image
    let uploadedImages: string[] = [];

    if (images && Array.isArray(images) && images.length > 0) {
      // Limit to max images
      const imagesToUpload = images.slice(0, maxImages);

      // Upload all images
      for (let i = 0; i < imagesToUpload.length; i++) {
        const result = await uploadService.uploadImage(imagesToUpload[i], {
          folder: "products",
          originalName: `product_${name.replace(/\s+/g, "_").toLowerCase()}_${i + 1}.jpg`,
        });
        uploadedImages.push(result.url);
      }
    } else if (image) {
      // Backward compatibility: if single image provided, use it
      const result = await uploadService.uploadImage(image, {
        folder: "products",
        originalName: `product_${name.replace(/\s+/g, "_").toLowerCase()}.jpg`,
      });
      uploadedImages.push(result.url);
    }

    // Ensure at least one image
    if (uploadedImages.length === 0) {
      res.status(400);
      throw new Error("At least one product image is required");
    }

    // Determine approval status based on user role
    const approvalStatus = req.user.role === "seller" ? "pending" : "approved";

    // Get seller ID if user is a seller
    let sellerId = null;
    if (req.user.role === "seller") {
      const Seller = (await import("../models/sellerModel.js")).default;
      const seller = await Seller.findOne({ userId: req.user._id });
      if (seller) {
        sellerId = seller._id;
      }
    }

    const product = await Product.create({
      name,
      description,
      price,
      category,
      brand,
      discountPercentage: discountPercentage || 0,
      stock: stock || 0,
      images: uploadedImages,
      image: uploadedImages[0], // Set first image as primary
      productType: (productType as any) || [],
      aboutItems: aboutItems || [],
      approvalStatus,
      seller: sellerId,
    });

    if (product) {
      res.status(201).json(product);
    } else {
      res.status(400);
      throw new Error("Invalid product data");
    }
  },
);

// @desc    Update a product
// @route   PUT /api/products/:id
// @access  Private/Admin
const updateProduct: RequestHandler = asyncHandler(
  async (req: RequestWithBody<ProductBody>, res) => {
    const {
      name,
      description,
      price,
      category,
      brand,
      image,
      images,
      discountPercentage,
      stock,
      productType,
      aboutItems,
    } = req.body;

    const product = await Product.findById(req.params.id);

    if (product) {
      // Check if new name is already taken by another product
      if (name && name !== product.name) {
        const productExists = await Product.findOne({ name });
        if (productExists) {
          res.status(400);
          throw new Error("Product with this name already exists");
        }
      }

      if (name) product.name = name;
      if (description) product.description = description;
      if (price) product.price = price;
      if (category) product.category = category as any;
      if (brand) product.brand = brand as any;
      if (discountPercentage !== undefined)
        product.discountPercentage = discountPercentage;
      if (stock !== undefined) product.stock = stock;
      if (productType) product.productType = productType as any;
      if (aboutItems) product.aboutItems = aboutItems;

      // Get max images from environment or default to 5
      const maxImages = parseInt(process.env.MAX_PRODUCT_IMAGES || "5");

      // Update images if provided
      if (images && Array.isArray(images) && images.length > 0) {
        const uploadedImages: string[] = [];
        const oldImages: string[] =
          product.images || (product.image ? [product.image] : []);

        // Limit to max images
        const imagesToProcess = images.slice(0, maxImages);

        for (let i = 0; i < imagesToProcess.length; i++) {
          const img = imagesToProcess[i];

          // If image URL is already in product images, keep it (no re-upload)
          if (oldImages.includes(img)) {
            uploadedImages.push(img);
          } else {
            // New image - upload it
            try {
              const result = await uploadService.uploadImage(img, {
                folder: "products",
                originalName: `product_${(name || product.name)
                  .replace(/\s+/g, "_")
                  .toLowerCase()}_${i + 1}.jpg`,
              });
              uploadedImages.push(result.url);
            } catch (error) {
              console.error("Error uploading image:", error);
              // Continue with other images even if one fails
            }
          }
        }

        // Clean up old images that are no longer used
        const imagesToDelete = oldImages.filter(
          (oldImg) => !uploadedImages.includes(oldImg),
        );
        for (const oldImg of imagesToDelete) {
          try {
            await uploadService.deleteImage(oldImg);
          } catch (error) {
            console.error("Error deleting old image:", error);
            // Continue even if deletion fails
          }
        }

        if (uploadedImages.length > 0) {
          product.images = uploadedImages;
          product.image = uploadedImages[0]; // Set first image as primary
        }
      } else if (image && image !== product.image) {
        // Backward compatibility: single image update
        const result = await uploadService.replaceImage(image, product.image, {
          folder: "products",
          originalName: `product_${(name || product.name)
            .replace(/\s+/g, "_")
            .toLowerCase()}.jpg`,
        });
        product.image = result.url;
        product.images = [result.url];
      }

      const updatedProduct = await product.save();
      res.json(updatedProduct);
    } else {
      res.status(404);
      throw new Error("Product not found");
    }
  },
);

// @desc    Rate a product
// @route   POST /api/products/:id/rate
// @access  Private
const rateProduct: RequestHandler = asyncHandler(
  async (req: RequestWithBody<RatingBody>, res) => {
    const { rating } = req.body;
    const product = await Product.findById(req.params.id);

    if (product) {
      const alreadyRated = product.ratings.find(
        (r) => r.userId.toString() === req.user._id.toString(),
      );

      if (alreadyRated) {
        // Update existing rating
        alreadyRated.rating = rating;
      } else {
        // Add new rating
        product.ratings.push({
          userId: req.user._id,
          rating,
        });
      }

      await product.save();
      res.json(product);
    } else {
      res.status(404);
      throw new Error("Product not found");
    }
  },
);

// @desc    Delete a product
// @route   DELETE /api/products/:id
// @access  Private/Admin
const deleteProduct: RequestHandler = asyncHandler(async (req, res) => {
  const product = await Product.findById(req.params.id);

  if (product) {
    // Delete associated image before deleting the product
    if (product.image) {
      try {
        await uploadService.deleteImage(product.image);
      } catch (error) {
        console.error(
          `Failed to delete product image: ${(error as any).message}`,
        );
        // Continue with product deletion even if image deletion fails
      }
    }

    await product.deleteOne();
    res.json({
      message: "Product and associated image removed successfully",
      deletedImage: product.image || null,
    });
  } else {
    res.status(404);
    throw new Error("Product not found");
  }
});

// @desc    Bulk delete products
// @route   POST /api/products/bulk-delete
// @access  Private/Admin
const bulkDeleteProducts: RequestHandler = asyncHandler(async (req, res) => {
  const { productIds } = req.body;

  if (!productIds || !Array.isArray(productIds) || productIds.length === 0) {
    res.status(400);
    throw new Error("Product IDs array is required");
  }

  // Find products to get their images
  const products = await Product.find({ _id: { $in: productIds } });

  if (products.length === 0) {
    res.status(404);
    throw new Error("No products found for the provided IDs");
  }

  // Collect all image URLs to delete
  const imagesToDelete: string[] = [];
  products.forEach((product) => {
    if (product.images && product.images.length > 0) {
      imagesToDelete.push(...product.images);
    } else if (product.image) {
      imagesToDelete.push(product.image);
    }
  });

  // Delete images from Cloudinary
  const deleteImagePromises = imagesToDelete.map((imageUrl) =>
    uploadService.deleteImage(imageUrl).catch((err) => {
      console.error(`Failed to delete image ${imageUrl}:`, err);
    }),
  );
  await Promise.all(deleteImagePromises);

  // Delete products from DB
  const result = await Product.deleteMany({ _id: { $in: productIds } });

  res.json({
    message: `Successfully deleted ${result.deletedCount} products`,
    deletedCount: result.deletedCount,
  });
});

// @desc    Track product view
// @route   POST /api/products/:id/view
// @access  Public
const trackProductView: RequestHandler = asyncHandler(async (req, res) => {
  try {
    // Use atomic update to avoid version conflicts
    const updateData = {
      $inc: { viewCount: 1 },
      $push: {
        views: {
          userId: req.user?._id || null,
          viewedAt: new Date(),
        },
      },
    };

    const product = await Product.findByIdAndUpdate(req.params.id, updateData, {
      new: true,
      runValidators: false,
    });

    if (product) {
      res.json({ viewCount: product.viewCount });
    } else {
      res.status(404);
      throw new Error("Product not found");
    }
  } catch (error) {
    console.error("Error tracking product view:", error);
    res.status(500);
    throw new Error("Failed to track product view");
  }
});


// @desc    Get pending products (Admin)
// @route   GET /api/products/pending
// @access  Private/Admin
const getPendingProducts: RequestHandler = asyncHandler(async (req, res) => {
  const products = await Product.find({ approvalStatus: "pending" })
    .populate("category", "name")
    .populate("brand", "name")
    .populate("seller", "storeName contactEmail")
    .populate("productType", "name type color displayOrder");

  res.json({
    success: true,
    count: products.length,
    products,
  });
});

// @desc    Get seller products (Admin: all seller products, Seller: own products)
// @route   GET /api/products/seller (Admin)
// @route   GET /api/products/seller/me (Seller)
// @access  Private/Admin or Private/Seller
const getSellerProducts: RequestHandler = asyncHandler(
  async (req: RequestWithQuery<ProductQuery>, res) => {
    // If admin is requesting, get all seller products
    if (req.user.role === "admin") {
      const { approvalStatus, seller } = req.query;

      // Build query filter
      const filter: any = { seller: { $exists: true } };

      // Add status filter if provided
      if (approvalStatus && approvalStatus !== "all") {
        filter.approvalStatus = approvalStatus;
      }

      // Add seller filter if provided
      if (seller && seller !== "all") {
        filter.seller = seller;
      }

      const products = await Product.find(filter)
        .populate("category", "name")
        .populate("brand", "name")
        .populate("seller", "businessName email")
        .populate("productType", "name type color displayOrder")
        .sort({ createdAt: -1 });

      res.json({
        success: true,
        count: products.length,
        products,
      });
      return;
    }

    // If seller is requesting, get their own products
    const Seller = (await import("../models/sellerModel.js")).default;
    const seller = await Seller.findOne({ userId: req.user._id });

    if (!seller) {
      res.status(404);
      throw new Error("Seller profile not found");
    }

    const products = await Product.find({ seller: seller._id })
      .populate("category", "name")
      .populate("brand", "name")
      .populate("productType", "name type color displayOrder")
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      count: products.length,
      products,
    });
  },
);

// @desc    Approve/Reject product (for seller products)
// @route   PUT /api/products/:id/approve
// @route   PUT /api/products/:id/approval
// @access  Private/Admin
const approveProduct: RequestHandler = asyncHandler(
  async (req: RequestWithBody<ApproveProductBody>, res) => {
    const { approve, approvalStatus } = req.body;
    const product = await Product.findById(req.params.id);

    if (!product) {
      res.status(404);
      throw new Error("Product not found");
    }

    // Handle both formats: { approve: true/false } and { approvalStatus: "approved"/"rejected" }
    if (approvalStatus) {
      product.approvalStatus = approvalStatus as
        | "approved"
        | "pending"
        | "rejected";
      await product.save();
      res.json({
        message: `Product ${approvalStatus} successfully`,
        product,
      });
    } else if (approve !== undefined) {
      product.approvalStatus = approve ? "approved" : "rejected";
      await product.save();
      res.json({
        message: `Product ${approve ? "approved" : "rejected"} successfully`,
        product,
      });
    } else {
      res.status(400);
      throw new Error("Please provide either 'approve' or 'approvalStatus'");
    }
  },
);

// @desc    Bulk create products
// @route   POST /api/products/bulk
// @access  Private/Admin
const bulkCreateProducts: RequestHandler = asyncHandler(
  async (req: RequestWithBody<BulkCreateBody>, res: Response) => {
    const { products } = req.body;

    if (!products || !Array.isArray(products) || products.length === 0) {
      res.status(400);
      throw new Error("Products array is required");
    }

    if (products.length > 100) {
      res.status(400);
      throw new Error("Cannot upload more than 100 products at once");
    }

    const results = {
      successful: [] as any[],
      failed: [] as any[],
    };

    for (const [index, productData] of products.entries()) {
      try {
        // Validate required fields
        if (
          !productData.name ||
          !productData.description ||
          !productData.category ||
          !productData.brand
        ) {
          results.failed.push({
            index: index + 1,
            data: productData,
            error: "Missing required fields",
          });
          continue;
        }

        // Check if product already exists
        const existingProduct = await Product.findOne({
          name: productData.name,
        });
        if (existingProduct) {
          results.failed.push({
            index: index + 1,
            data: productData,
            error: `Product "${productData.name}" already exists`,
          });
          continue;
        }

        // Create product
        const product = await Product.create({
          name: productData.name,
          description: productData.description,
          price: productData.price || 0,
          discountPercentage: productData.discountPercentage || 0,
          stock: productData.stock || 0,
          category: productData.category,
          brand: productData.brand,
          images: productData.images || [],
          image: productData.images?.[0] || "",
          productType: (productData.productType as any) || [],
        });

        results.successful.push({
          index: index + 1,
          product: product,
        });
      } catch (error) {
        results.failed.push({
          index: index + 1,
          data: productData,
          error: (error as any).message,
        });
      }
    }

    res.status(201).json({
      success: true,
      message: `Successfully created ${results.successful.length} of ${products.length} products`,
      results,
    });
  },
);

// @desc    Search products by image
// @route   POST /api/products/search-by-image
// @access  Public
const searchProductsByImage: RequestHandler = asyncHandler(
  async (req: Request, res: Response) => {
    // Check if image was uploaded
    if (!req.file) {
      res.status(400);
      throw new Error("Please upload an image");
    }

    try {
      // Extract dominant colors from uploaded image
      const uploadedImageColors = await extractDominantColors(req.file.buffer);

      if (uploadedImageColors.length === 0) {
        console.warn("Could not extract colors from uploaded image");
      }

      // Get all products with images
      const allProducts = await Product.find({
        image: { $exists: true, $ne: "" },
      })
        .populate("category", "name")
        .populate("brand", "name")
        .populate("productType", "name type color displayOrder")
        .select(
          "name description price image images category brand stock averageRating numReviews discountPercentage",
        )
        .lean();

      // Calculate similarity for each product
      const productsWithSimilarity = await Promise.all(
        allProducts.map(async (product) => {
          try {
            // Extract colors from product's main image (with caching)
            const productColors = await getCachedProductColors(
              product.image,
              extractColorsFromUrl,
            );

            if (productColors.length === 0) {
              return { ...product, similarity: 0 };
            }

            // Calculate similarity score
            const similarity = calculateColorSimilarity(
              uploadedImageColors,
              productColors,
            );

            return { ...product, similarity };
          } catch (error) {
            console.error(
              `Error processing product ${product._id}:`,
              (error as any).message,
            );
            return { ...product, similarity: 0 };
          }
        }),
      );

      // Sort by similarity (highest first) and filter out low similarity scores
      const similarProducts = productsWithSimilarity
        .filter((product) => product.similarity > 60) // Only products with >60% similarity (stricter matching)
        .sort((a, b) => b.similarity - a.similarity)
        .slice(0, 8); // Return top 8 matches

      // If less than 3 very similar products, try relaxed threshold
      if (similarProducts.length < 3) {
        const relaxedProducts = productsWithSimilarity
          .filter((product) => product.similarity > 45)
          .sort((a, b) => b.similarity - a.similarity)
          .slice(0, 8);

        // If still no matches, return empty result - don't show unrelated products
        if (relaxedProducts.length === 0) {
          res.json({
            products: [],
            total: 0,
            message:
              "No matching products found for this image. Please try uploading a product image.",
            similaritySearch: false,
          });
          return;
        }

        // Use relaxed results
        const cleanProducts = relaxedProducts.map(
          ({ similarity, ...product }) => ({
            ...product,
            matchScore: Math.round(similarity),
          }),
        );

        res.json({
          products: cleanProducts,
          total: cleanProducts.length,
          message: "Products with moderate visual similarity",
          similaritySearch: true,
        });
        return;
      }

      // Remove similarity field before sending response
      const cleanProducts = similarProducts.map(
        ({ similarity, ...product }) => ({
          ...product,
          matchScore: Math.round(similarity), // Include match score for reference
        }),
      );

      res.json({
        products: cleanProducts,
        total: cleanProducts.length,
        message: "Products matched by visual similarity",
        similaritySearch: true,
      });
    } catch (error) {
      console.error("Image search error:", error);

      // Return empty result on error - don't show unrelated products
      res.json({
        products: [],
        total: 0,
        message:
          "Image analysis failed. Please try again with a different image.",
        error: (error as any).message,
        similaritySearch: false,
      });
    }
  },
);

export {
  getProducts,
  getProductById,
  getProductById as getSingleProduct,
  createProduct,
  updateProduct,
  rateProduct,
  deleteProduct,
  trackProductView,

  getPendingProducts,
  getSellerProducts,
  approveProduct,
  bulkCreateProducts,
  bulkDeleteProducts,
  searchProductsByImage,
};
