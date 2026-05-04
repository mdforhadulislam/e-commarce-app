import mongoose from "mongoose";

const categorySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
    },
    slug: {
      type: String,
      unique: true,
      sparse: true, // Allows unique constraint to work with auto-generation
    },
    image: {
      type: String,
      required: false, // Image is optional
    },
    iconImage: {
      type: String,
      required: false, // Icon image is optional
    },
    categoryType: {
      type: [
        {
          type: String,
          enum: ["Featured", "Hot Categories", "Top Categories"],
        },
      ],
      required: false,
      default: [],
    },
    // Parent category reference (null for root categories)
    parent: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
      default: null,
    },
    // Materialized path for efficient hierarchy queries (e.g., "parentId,childId,grandchildId")
    path: {
      type: String,
      default: "",
    },
    // Level in hierarchy (0 for root, 1 for first level children, etc.)
    level: {
      type: Number,
      default: 0,
      min: 0,
    },
    // Order for sorting categories at the same level
    order: {
      type: Number,
      default: 0,
    },
    // Whether this category is active
    isActive: {
      type: Boolean,
      default: true,
    },
    // Description for SEO
    description: {
      type: String,
      default: "",
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
);

// Virtual field to get children categories
categorySchema.virtual("children", {
  ref: "Category",
  localField: "_id",
  foreignField: "parent",
});

// Index for efficient queries
// Note: slug already has unique index from schema definition
categorySchema.index({ parent: 1, order: 1 });
categorySchema.index({ path: 1 });
categorySchema.index({ isActive: 1 });

// Generate slug from name or provided slug before saving
categorySchema.pre("save", async function () {
  if (this.isModified("slug") || this.isModified("name") || this.isNew) {
    // If slug is explicitly provided, use it. Otherwise, use name.
    // We only auto-generate from name if it's new and no slug is provided,
    // or if the user explicitly cleared the slug (which we might disallow, but just in case).
    if (!this.isNew && !this.isModified("slug") && this.slug) {
      // Do nothing if it's an update, the slug wasn't changed, and it already has a slug.
      // This preserves existing slugs when only the name is updated.
      return;
    }

    const sourceText = this.slug ? this.slug : this.name;
    let baseSlug = sourceText
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");

    // Ensure slug uniqueness
    let slug = baseSlug;
    let counter = 1;

    // Check if slug exists (excluding current document for updates)
    while (true) {
      const existingCategory = await (this.constructor as any).findOne({
        slug: slug,
        _id: { $ne: this._id },
      });

      if (!existingCategory) {
        break;
      }

      slug = `${baseSlug}-${counter}`;
      counter++;
    }

    this.slug = slug;
  }
});

// Update path and level before saving
categorySchema.pre("save", async function () {
  if (this.isModified("parent") || this.isNew) {
    if (this.parent) {
      try {
        const parentCategory = await (this.constructor as any).findById(
          this.parent,
        );
        if (parentCategory) {
          this.path = parentCategory.path
            ? `${parentCategory.path},${this.parent}`
            : `${this.parent}`;
          this.level = parentCategory.level + 1;
        } else {
          // Parent not found, treat as root
          this.parent = null;
          this.path = "";
          this.level = 0;
        }
      } catch (error) {
        console.error("Error finding parent category:", error);
        this.parent = null;
        this.path = "";
        this.level = 0;
      }
    } else {
      // Root category
      this.path = "";
      this.level = 0;
    }
  }
});

// Update all children paths when category is moved
categorySchema.post("save", async function (doc) {
  if ((this as any).wasNew) return; // Skip for new documents

  try {
    // Find all children of this category
    const children = await (this.constructor as any).find({ parent: doc._id });

    // Update each child's path
    for (const child of children) {
      child.path = doc.path ? `${doc.path},${doc._id}` : `${doc._id}`;
      child.level = doc.level + 1;
      await child.save();
    }
  } catch (error) {
    console.error("Error updating children paths:", error);
  }
});

// Method to get all ancestor categories
categorySchema.methods.getAncestors = async function () {
  if (!this.path) return [];

  const ancestorIds = this.path.split(",").filter(Boolean);
  return await (this.constructor as any)
    .find({ _id: { $in: ancestorIds } })
    .sort({ level: 1 });
};

// Method to get all descendant categories
categorySchema.methods.getDescendants = async function () {
  const regex = new RegExp(`^${this._id}(,|$)`);
  return await (this.constructor as any)
    .find({
      path: regex,
    })
    .sort({ level: 1, order: 1 });
};

// Method to check if category has children
categorySchema.methods.hasChildren = async function () {
  const count = await (this.constructor as any).countDocuments({
    parent: this._id,
  });
  return count > 0;
};

// Static method to get category tree
categorySchema.statics.getTree = async function (parentId = null) {
  const categories = await this.find({ parent: parentId, isActive: true })
    .sort({ order: 1, name: 1 })
    .lean();

  for (const category of categories) {
    category.children = await (this as any).getTree(category._id);
  }

  return categories;
};

// Prevent deletion if category has children
categorySchema.pre(
  "deleteOne",
  { document: true, query: false },
  async function () {
    const hasChildren = await (this as any).hasChildren();
    if (hasChildren) {
      throw new Error(
        "Cannot delete category with subcategories. Please delete or reassign subcategories first.",
      );
    }
  },
);

const Category = mongoose.model("Category", categorySchema);

export default Category;
