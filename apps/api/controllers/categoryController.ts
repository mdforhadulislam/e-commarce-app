import { RequestHandler } from "express";
import asyncHandler from "express-async-handler";
import Category from "../models/categoryModel.js";
import Product from "../models/productModel.js";
import uploadService from "../config/uploadService.js";
import {
  PaginationQuery,
  RequestWithQuery,
  RequestWithBody,
} from "../types/express.js";

interface CategoryQuery extends PaginationQuery {
  parent?: string | null;
  categoryType?: string;
  level?: string;
}

interface CategoryBody {
  name: string;
  slug?: string;
  image?: string;
  iconImage?: string;
  categoryType?: string;
  parent?: string | null;
  order?: number;
  description?: string;
  isActive?: boolean;
}

interface BulkCreateBody {
  categories: CategoryBody[];
}

// @desc    Get all categories
// @route   GET /api/categories
// @access  Private
const getCategories: RequestHandler = asyncHandler(
  async (req: RequestWithQuery<CategoryQuery>, res) => {
    const page = parseInt(req.query.page || "1");
    const perPage = parseInt(req.query.perPage || "20");
    const sortOrder = req.query.sortOrder || "asc";
    const parentId = req.query.parent;
    const categoryType = req.query.categoryType;

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

    const filter: Record<string, any> = {
      isActive: true,
    };

    // Only filter by parent if explicitly specified
    if (parentId !== undefined) {
      filter.parent = parentId === "null" ? null : parentId;
    }

    // Filter by categoryType if specified
    if (categoryType) {
      filter.categoryType = categoryType;
    }

    const skip = (page - 1) * perPage;
    const total = await Category.countDocuments(filter);
    const sortValue = sortOrder === "asc" ? 1 : -1;
    const categories = await Category.find(filter)
      .populate("parent", "name slug")
      .skip(skip)
      .limit(perPage)
      .sort({ order: 1, createdAt: sortValue });

    const totalPages = Math.ceil(total / perPage);

    res.json({ categories, total, page, perPage, totalPages });
  },
);

// @desc    Get category tree (hierarchical structure)
// @route   GET /api/categories/tree
// @access  Public
const getCategoryTree: RequestHandler = asyncHandler(async (req, res) => {
  const tree = await (Category as any).getTree();
  res.json(tree);
});

// @desc    Get all subcategories of a category
// @route   GET /api/categories/:id/subcategories
// @access  Public
const getSubcategories: RequestHandler = asyncHandler(async (req, res) => {
  const category = await Category.findById(req.params.id);

  if (!category) {
    res.status(404);
    throw new Error("Category not found");
  }

  const subcategories = await Category.find({
    parent: category._id,
    isActive: true,
  }).sort({ order: 1, name: 1 });

  res.json(subcategories);
});

// @desc    Get all categories for admin with advanced filtering
// @route   GET /api/categories/admin
// @access  Private (Admin)
const getCategoriesAdmin: RequestHandler = asyncHandler(
  async (req: RequestWithQuery<CategoryQuery>, res) => {
    const page = parseInt(req.query.page || "1");
    const perPage = parseInt(req.query.perPage || "10");
    const sortOrder = req.query.sortOrder || "desc";
    const search = req.query.search;
    const categoryType = req.query.categoryType;
    const parentId = req.query.parent;
    const level = req.query.level;

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

    // Category type filter
    if (categoryType && categoryType !== "all") {
      filter.categoryType = categoryType;
    }

    // Parent filter
    if (parentId !== undefined) {
      filter.parent = parentId === "null" || parentId === "" ? null : parentId;
    }

    // Level filter
    if (level !== undefined) {
      filter.level = parseInt(level);
    }

    const skip = (page - 1) * perPage;
    const total = await Category.countDocuments(filter);
    const sortValue = sortOrder === "asc" ? 1 : -1;

    const categories = await Category.find(filter)
      .populate("parent", "name slug level")
      .skip(skip)
      .limit(perPage)
      .sort({ level: 1, order: 1, createdAt: sortValue });

    // Add children count to each category
    const categoriesWithCount = await Promise.all(
      categories.map(async (category) => {
        const childrenCount = await Category.countDocuments({
          parent: category._id,
        });
        const productCount = await Product.countDocuments({
          category: category._id,
        });
        return {
          ...category.toObject(),
          childrenCount,
          productCount,
        };
      }),
    );

    const totalPages = Math.ceil(total / perPage);

    res.json({
      categories: categoriesWithCount,
      total,
      page,
      perPage,
      totalPages,
    });
  },
);

// @desc    Get category by ID
// @route   GET /api/categories/:id
// @access  Private
const getCategoryById: RequestHandler = asyncHandler(async (req, res) => {
  const category = await Category.findById(req.params.id).populate(
    "parent",
    "name slug level",
  );

  if (category) {
    // Get ancestors
    const ancestors = await (category as any).getAncestors();
    // Get children
    const children = await Category.find({ parent: category._id }).sort({
      order: 1,
      name: 1,
    });

    res.json({
      ...category.toObject(),
      ancestors,
      children,
    });
  } else {
    res.status(404);
    throw new Error("Category not found");
  }
});

// @desc    Create a category
// @route   POST /api/categories
// @access  Private/Admin
const createCategory: RequestHandler = asyncHandler(
  async (req: RequestWithBody<CategoryBody>, res) => {
    const {
      name,
      slug,
      image,
      iconImage,
      categoryType,
      parent,
      order,
      description,
    } = req.body;

    // Validate inputs
    if (!name || typeof name !== "string") {
      res.status(400);
      throw new Error("Category name is required and must be a string");
    }

    // Validate categoryType if it's an array
    const validCategoryTypes = ["Featured", "Hot Categories", "Top Categories"];
    if (categoryType && Array.isArray(categoryType)) {
      const invalidTypes = categoryType.filter(
        (type) => !validCategoryTypes.includes(type),
      );
      if (invalidTypes.length > 0) {
        res.status(400);
        throw new Error("Invalid category types provided");
      }
    } else if (categoryType) {
      res.status(400);
      throw new Error("categoryType must be an array");
    }

    // Validate parent if provided
    if (parent) {
      const parentCategory = await Category.findById(parent);
      if (!parentCategory) {
        res.status(400);
        throw new Error("Parent category not found");
      }
      // Optional: Add max depth validation
      if (parentCategory.level >= 3) {
        res.status(400);
        throw new Error("Maximum category depth (4 levels) exceeded");
      }
    }

    // Check for duplicate name or order at the same level
    const duplicateFilter: Record<string, any> = {};
    if (parent) {
      duplicateFilter.parent = parent;
    } else {
      duplicateFilter.parent = null;
    }

    // Check name uniqueness
    const nameExists = await Category.findOne({
      ...duplicateFilter,
      name: name,
    });

    if (nameExists) {
      res.status(400);
      throw new Error("Category with this name already exists at this level");
    }

    // Check slug uniqueness strictly if provided explicitly
    if (slug) {
      const slugExists = await Category.findOne({ slug });
      if (slugExists) {
        res.status(400);
        throw new Error(
          "A category with this slug already exists. Slugs must be unique.",
        );
      }
    }

    // Check order uniqueness if order is provided
    if (order !== undefined) {
      const orderExists = await Category.findOne({
        ...duplicateFilter,
        order: order,
      });

      if (orderExists) {
        res.status(400);
        throw new Error(
          `Display order ${order} is already used by another category at this level`,
        );
      }
    }

    let imageUrl = "";
    if (image) {
      const result = await uploadService.uploadImage(image, {
        folder: "categories",
        originalName: `category_${name.replace(/\s+/g, "_").toLowerCase()}.jpg`,
      });
      imageUrl = result.url;
    }

    let iconImageUrl = "";
    if (iconImage) {
      const result = await uploadService.uploadImage(iconImage, {
        folder: "categories/iconImage",
        originalName: `category_icon_${name.replace(/\s+/g, "_").toLowerCase()}.svg`,
      });
      iconImageUrl = result.url;
    }

    const category = await Category.create({
      name,
      ...(slug && { slug }), // Only pass slug if available so model pre(save) handles generation if absent
      image: imageUrl || undefined,
      iconImage: iconImageUrl || undefined,
      categoryType:
        (categoryType as unknown as (
          | "Featured"
          | "Hot Categories"
          | "Top Categories"
        )[]) || [],
      parent: parent || null,
      order: order || 0,
      description: description || "",
    });

    // Populate parent before sending response
    await category.populate("parent", "name slug level");

    if (category) {
      res.status(201).json(category);
    } else {
      res.status(400);
      throw new Error("Invalid category data");
    }
  },
);

// @desc    Update a category
// @route   PUT /api/categories/:id
// @access  Private/Admin
const updateCategory: RequestHandler = asyncHandler(
  async (req: RequestWithBody<CategoryBody>, res) => {
    const {
      name,
      slug,
      image,
      iconImage,
      categoryType,
      parent,
      order,
      description,
      isActive,
    } = req.body;

    // Validate categoryType if it's an array
    const validCategoryTypes = ["Featured", "Hot Categories", "Top Categories"];
    if (categoryType !== undefined) {
      if (Array.isArray(categoryType)) {
        const invalidTypes = categoryType.filter(
          (type) => !validCategoryTypes.includes(type),
        );
        if (invalidTypes.length > 0) {
          res.status(400);
          throw new Error("Invalid category types provided");
        }
      } else {
        res.status(400);
        throw new Error("categoryType must be an array");
      }
    }

    const category = await Category.findById(req.params.id);

    if (!category) {
      res.status(404);
      throw new Error("Category not found");
    }

    // Validate parent change
    if (parent !== undefined && parent !== category.parent?.toString()) {
      // Prevent circular reference
      if (parent === category._id.toString()) {
        res.status(400);
        throw new Error("Category cannot be its own parent");
      }

      // Prevent setting a descendant as parent
      if (parent) {
        const descendants = await (category as any).getDescendants();
        const descendantIds = descendants.map((d: any) => d._id.toString());
        if (descendantIds.includes(parent)) {
          res.status(400);
          throw new Error("Cannot set a descendant category as parent");
        }

        // Validate parent exists
        const parentCategory = await Category.findById(parent);
        if (!parentCategory) {
          res.status(400);
          throw new Error("Parent category not found");
        }

        // Check max depth
        if (parentCategory.level >= 3) {
          res.status(400);
          throw new Error("Maximum category depth (4 levels) exceeded");
        }
      }

      category.parent = (parent as any) || null;
    }

    // Check unique order constraint if order is being changed or parent is changed
    if (order !== undefined || parent !== undefined) {
      const targetParent =
        parent !== undefined ? parent || null : category.parent;
      const targetOrder = order !== undefined ? order : category.order;

      const orderExists = await Category.findOne({
        parent: targetParent,
        order: targetOrder,
        _id: { $ne: category._id },
      });

      if (orderExists) {
        res.status(400);
        throw new Error(
          `Display order ${targetOrder} is already used by another category at this level`,
        );
      }
    }

    // Check uniqueness of manually input slug
    if (slug !== undefined && slug !== category.slug) {
      if (slug.trim() === "") {
        res.status(400);
        throw new Error("Slug cannot be empty");
      }

      const slugExists = await Category.findOne({
        slug,
        _id: { $ne: category._id },
      });
      if (slugExists) {
        res.status(400);
        throw new Error(
          "A category with this slug already exists. Slugs must be unique.",
        );
      }
      category.slug = slug;
    }

    if (name) category.name = name;
    if (categoryType !== undefined)
      category.categoryType = categoryType as unknown as (
        | "Featured"
        | "Hot Categories"
        | "Top Categories"
      )[];
    if (order !== undefined) category.order = order;
    if (description !== undefined) category.description = description;
    if (isActive !== undefined) category.isActive = isActive;

    // Handle image update
    if (image !== undefined) {
      if (image) {
        const result = await uploadService.replaceImage(image, category.image, {
          folder: "categories",
          originalName: `category_${(name || category.name)
            .replace(/\s+/g, "_")
            .toLowerCase()}.jpg`,
        });
        category.image = result.url;
      } else {
        // Delete old image if clearing the field
        if (category.image) {
          try {
            await uploadService.deleteImage(category.image);
          } catch (error) {
            console.error(
              `Failed to delete old category image: ${(error as any).message}`,
            );
          }
        }
        category.image = undefined;
      }
    }

    // Handle icon image update
    if (iconImage !== undefined) {
      if (iconImage) {
        const result = await uploadService.replaceImage(
          iconImage,
          (category as any).iconImage,
          {
            folder: "categories/iconImage",
            originalName: `category_icon_${(name || category.name)
              .replace(/\s+/g, "_")
              .toLowerCase()}.svg`,
          },
        );
        (category as any).iconImage = result.url;
      } else {
        // Delete old icon image if clearing the field
        if ((category as any).iconImage) {
          try {
            await uploadService.deleteImage((category as any).iconImage);
          } catch (error) {
            console.error(
              `Failed to delete old category icon image: ${(error as any).message}`,
            );
          }
        }
        (category as any).iconImage = undefined;
      }
    }

    const updatedCategory = await category.save();
    await updatedCategory.populate("parent", "name slug level");

    res.json(updatedCategory);
  },
);

// @desc    Delete a category
// @route   DELETE /api/categories/:id
// @access  Private/Admin
const deleteCategory: RequestHandler = asyncHandler(async (req, res) => {
  const category = await Category.findById(req.params.id);

  if (!category) {
    res.status(404);
    throw new Error("Category not found");
  }

  // Check if category has children
  const hasChildren = await (category as any).hasChildren();
  if (hasChildren) {
    res.status(400);
    throw new Error(
      "Cannot delete category with subcategories. Please delete or reassign subcategories first.",
    );
  }

  // Check if category has products
  const productCount = await Product.countDocuments({ category: category._id });
  if (productCount > 0) {
    res.status(400);
    throw new Error(
      `Cannot delete category with ${productCount} associated product(s). Please reassign or delete products first.`,
    );
  }

  // Delete associated image before deleting the category
  if (category.image) {
    try {
      await uploadService.deleteImage(category.image);
    } catch (error) {
      console.error(
        `Failed to delete category image: ${(error as any).message}`,
      );
      // Continue with category deletion even if image deletion fails
    }
  }

  await category.deleteOne();
  res.json({
    message: "Category and associated image removed successfully",
    deletedImage: category.image || null,
  });
});

// @desc    Bulk create categories
// @route   POST /api/categories/bulk
// @access  Private/Admin
const bulkCreateCategories: RequestHandler = asyncHandler(
  async (req: RequestWithBody<BulkCreateBody>, res) => {
    const { categories } = req.body;

    if (!Array.isArray(categories) || categories.length === 0) {
      res.status(400);
      throw new Error("Categories array is required");
    }

    const results = {
      successful: [],
      failed: [],
    };

    for (const categoryData of categories) {
      try {
        // Validate required fields
        if (!categoryData.name) {
          results.failed.push({
            data: categoryData,
            error: "Category name is required",
          });
          continue;
        }

        // Check if parent exists if provided
        if (categoryData.parent) {
          const parentCategory = await Category.findById(categoryData.parent);
          if (!parentCategory) {
            results.failed.push({
              data: categoryData,
              error: "Parent category not found",
            });
            continue;
          }

          // Check max depth
          if (parentCategory.level >= 3) {
            results.failed.push({
              data: categoryData,
              error: "Maximum category depth exceeded (max 4 levels)",
            });
            continue;
          }
        }

        // Create category
        const category = await Category.create({
          name: categoryData.name,
          categoryType:
            (categoryData.categoryType as unknown as (
              | "Featured"
              | "Hot Categories"
              | "Top Categories"
            )[]) || [],
          parent: categoryData.parent || null,
          order: categoryData.order || 0,
          description: categoryData.description || "",
          isActive: true,
        });

        results.successful.push(category);
      } catch (error) {
        results.failed.push({
          data: categoryData,
          error: (error as any).message,
        });
      }
    }

    res.status(201).json({
      message: `Bulk upload completed: ${results.successful.length} successful, ${results.failed.length} failed`,
      successful: results.successful,
      failed: results.failed,
    });
  },
);

export {
  getCategories,
  getCategoryTree,
  getSubcategories,
  getCategoriesAdmin,
  getCategoryById,
  createCategory,
  updateCategory,
  deleteCategory,
  bulkCreateCategories,
  bulkDeleteCategories,
};

// @desc    Bulk delete categories
// @route   POST /api/categories/bulk-delete
// @access  Private/Admin
const bulkDeleteCategories: RequestHandler = asyncHandler(async (req, res) => {
  const { categoryIds } = req.body;

  if (!categoryIds || !Array.isArray(categoryIds) || categoryIds.length === 0) {
    res.status(400);
    throw new Error("Category IDs array is required");
  }

  const results = {
    successful: [] as string[],
    failed: [] as { id: string; name: string; reason: string }[],
  };

  for (const id of categoryIds) {
    const category = await Category.findById(id);

    if (!category) {
      results.failed.push({
        id,
        name: "Unknown",
        reason: "Category not found",
      });
      continue;
    }

    // Check validation: Has children?
    const childrenCount = await Category.countDocuments({ parent: id });
    if (childrenCount > 0) {
      results.failed.push({
        id,
        name: category.name,
        reason: `Cannot delete: Has ${childrenCount} subcategories`,
      });
      continue;
    }

    // Check validation: Has products?
    const productCount = await Product.countDocuments({ category: id });
    if (productCount > 0) {
      results.failed.push({
        id,
        name: category.name,
        reason: `Cannot delete: Associated with ${productCount} products`,
      });
      continue;
    }

    try {
      // Delete image if exists
      if (category.image) {
        await uploadService.deleteImage(category.image).catch((err) => {
          console.error(
            `Failed to delete image for category ${category.name}:`,
            err,
          );
        });
      }

      // Delete icon image if exists
      if ((category as any).iconImage) {
        await uploadService
          .deleteImage((category as any).iconImage)
          .catch((err) => {
            console.error(
              `Failed to delete icon image for category ${category.name}:`,
              err,
            );
          });
      }

      await category.deleteOne();
      results.successful.push(id);
    } catch (error) {
      results.failed.push({
        id,
        name: category.name,
        reason: (error as any).message,
      });
    }
  }

  res.json({
    message: `Processed ${categoryIds.length} categories`,
    results,
  });
});
