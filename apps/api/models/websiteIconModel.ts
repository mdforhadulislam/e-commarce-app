import mongoose from "mongoose";

const websiteIconSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Icon name is required"],
      trim: true,
      unique: true,
    },
    key: {
      type: String,
      required: [true, "Icon key is required"],
      trim: true,
      unique: true,
      lowercase: true,
    },
    imageUrl: {
      type: String,
      required: [true, "Image URL is required"],
    },
    description: {
      type: String,
      trim: true,
    },
    category: {
      type: String,
      enum: ["logo", "favicon", "social", "footer", "header", "other"],
      default: "other",
    },
    dimensions: {
      width: Number,
      height: Number,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  },
);

// Indexes
websiteIconSchema.index({ category: 1 });
websiteIconSchema.index({ isActive: 1 });

const WebsiteIcon = mongoose.model("WebsiteIcon", websiteIconSchema);

export default WebsiteIcon;
