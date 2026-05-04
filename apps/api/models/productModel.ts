import mongoose from "mongoose";
import "./sellerModel.js";

const productSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      unique: true,
    },
    slug: {
      type: String,
      unique: true,
      index: true,
    },
    description: {
      type: String,
      required: true,
    },
    aboutItems: {
      type: [String],
      default: [],
    },
    price: {
      type: Number,
      required: true,
      default: 0,
    },
    purchasePrice: {
      type: Number,
      default: 0,
      min: 0,
    },
    profitMargin: {
      type: Number,
      default: 0,
      min: 0,
      max: 100, // Percentage
    },
    discountPercentage: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },
    stock: {
      type: Number,
      default: 0,
      min: 0,
    },
    sold: {
      type: Number,
      default: 0,
      min: 0,
    },
    ratings: [
      {
        userId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
          required: true,
        },
        rating: {
          type: Number,
          required: true,
          min: 1,
          max: 5,
        },
        createdAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    averageRating: {
      type: Number,
      default: 0,
    },
    numReviews: {
      type: Number,
      default: 0,
    },
    reviews: [
      {
        userId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
          required: true,
        },
        userName: {
          type: String,
          required: true,
        },
        rating: {
          type: Number,
          required: true,
          min: 1,
          max: 5,
        },
        comment: {
          type: String,
          required: true,
        },
        isApproved: {
          type: Boolean,
          default: false,
        },
        createdAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    viewCount: {
      type: Number,
      default: 0,
    },
    views: [
      {
        userId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
        },
        viewedAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    image: {
      type: String,
      required: true,
    },
    images: {
      type: [String],
      default: function () {
        // Auto-populate images array with existing image for backward compatibility
        return this.image ? [this.image] : [];
      },
    },
    category: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: "Category",
    },
    brand: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: "Brand",
    },
    productType: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "ProductType",
      },
    ],
    seller: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Seller",
    },
    approvalStatus: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "approved", // Default to approved for admin created products, controller handles seller logic
    },
  },
  {
    timestamps: true,
  },
);

// Generate slug from product details before save
productSchema.pre("save", async function () {
  if (!this.slug || this.isModified("name")) {
    const slugParts = [];

    // Add product name
    const nameSlug = this.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
    slugParts.push(nameSlug);

    // Populate category and brand if they are ObjectIds
    if (this.isModified("category") && this.category) {
      await this.populate("category");
    }
    if (this.isModified("brand") && this.brand) {
      await this.populate("brand");
    }

    // Add category if available
    if (this.category && (this.category as any).name) {
      const categorySlug = (this.category as any).name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
      slugParts.push(categorySlug);
    }

    // Create base slug
    let baseSlug = slugParts.join("-");
    let finalSlug = baseSlug;
    let counter = 1;

    // Check for unique slug
    while (
      await mongoose
        .model("Product")
        .findOne({ slug: finalSlug, _id: { $ne: this._id } })
    ) {
      finalSlug = `${baseSlug}-${counter}`;
      counter++;
    }

    this.slug = finalSlug;
  }
});

// Ensure images array and image field stay in sync
productSchema.pre("save", async function () {
  // If images array exists and has items, set image to first item
  if (this.images && this.images.length > 0) {
    this.image = this.images[0];
  }
  // If image exists but images is empty, populate images with image
  else if (this.image && (!this.images || this.images.length === 0)) {
    this.images = [this.image];
  }
});

// Calculate average rating and review count before saving
productSchema.pre("save", async function () {
  // Calculate from approved reviews
  const approvedReviews = (this.reviews as any).filter(
    (review: any) => review.isApproved,
  );
  if (approvedReviews.length > 0) {
    const sum = approvedReviews.reduce((acc, item) => acc + item.rating, 0);
    this.averageRating = sum / approvedReviews.length;
    this.numReviews = approvedReviews.length;
  } else {
    this.averageRating = 0;
    this.numReviews = 0;
  }
});

const Product = mongoose.model("Product", productSchema);

export default Product;
