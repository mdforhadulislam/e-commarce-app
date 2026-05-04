import mongoose from "mongoose";

const adsBannerSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Name is required"],
      trim: true,
    },
    title: {
      type: String,
      required: [true, "Title is required"],
      trim: true,
    },
    description: {
      type: String,
      trim: true,
    },
    image: {
      type: String,
      required: [true, "Image is required"],
    },
    link: {
      type: String,
      trim: true,
    },
    bannerType: {
      type: String,
      required: [true, "Banner type is required"],
      enum: ["advertisement", "promotional", "seasonal", "offer"],
      default: "advertisement",
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    order: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

const AdsBanner = mongoose.model("AdsBanner", adsBannerSchema);

export default AdsBanner;
