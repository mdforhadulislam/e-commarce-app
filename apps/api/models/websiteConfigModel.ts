import mongoose from "mongoose";

const websiteConfigSchema = new mongoose.Schema(
  {
    pageType: {
      type: String,
      required: [true, "Page type is required"],
      enum: ["home", "product", "blog", "category", "about", "contact"],
      index: true,
    },
    componentType: {
      type: String,
      required: [true, "Component type is required"],
      trim: true,
    },
    title: {
      type: String,
      required: [true, "Component title is required"],
      trim: true,
    },
    description: {
      type: String,
      trim: true,
    },
    weight: {
      type: Number,
      required: [true, "Weight/order is required"],
      default: 0,
      index: true,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    settings: {
      // Generic images array for any component
      images: [String],

      // Banner settings
      bannerId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Banner",
      },
      bannerIds: [
        {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Banner",
        },
      ],

      // Products settings
      productDisplayType: {
        type: String,
        enum: ["grid", "list", "carousel", "featured"],
      },
      productsLimit: Number,
      productFilter: {
        category: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Category",
        },
        brand: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Brand",
        },
        tags: [String],
        isFeatured: Boolean,
        isOnSale: Boolean,
        minPrice: Number,
        maxPrice: Number,
      },
      showRating: Boolean,
      showQuickView: Boolean,

      // Ads settings
      adImageUrl: String,
      adLink: String,
      adPosition: {
        type: String,
        enum: ["top", "middle", "bottom", "sidebar"],
      },
      adSize: {
        type: String,
        enum: ["small", "medium", "large", "full-width"],
      },

      // Carousel settings
      carouselType: {
        type: String,
        enum: ["products", "images", "brands", "categories"],
      },
      autoPlay: Boolean,
      autoPlaySpeed: Number,
      showDots: Boolean,
      showArrows: Boolean,
      itemsPerView: Number,

      // Featured categories settings
      categoryIds: [
        {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Category",
        },
      ],
      categoryDisplayStyle: {
        type: String,
        enum: ["grid", "carousel", "list"],
      },

      // Brands settings
      brandIds: [
        {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Brand",
        },
      ],
      brandDisplayStyle: {
        type: String,
        enum: ["grid", "carousel", "list"],
      },

      // Custom HTML
      customHtml: String,
      customCss: String,

      // Common settings
      backgroundColor: String,
      textColor: String,
      containerWidth: {
        type: String,
        enum: ["full", "container", "narrow"],
        default: "container",
      },
      paddingTop: Number,
      paddingBottom: Number,
      marginTop: Number,
      marginBottom: Number,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
  {
    timestamps: true,
  }
);

// Index for efficient queries
websiteConfigSchema.index({ pageType: 1, weight: 1 });
websiteConfigSchema.index({ pageType: 1, isActive: 1, weight: 1 });

const WebsiteConfig = mongoose.model("WebsiteConfig", websiteConfigSchema);

export default WebsiteConfig;
