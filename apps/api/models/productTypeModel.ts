import mongoose from "mongoose";

const productTypeSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      unique: true,
    },
    type: {
      type: String,
      required: true,
      unique: true,
    },
    description: {
      type: String,
      default: "",
    },
    bannerImages: {
      type: [String],
      default: [],
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    displayOrder: {
      type: Number,
      default: 0,
    },
    icon: {
      type: String,
      default: "",
    },
    color: {
      type: String,
      default: "#6B7280", // Default gray color
    },
  },
  {
    timestamps: true,
  }
);

const ProductType = mongoose.model("ProductType", productTypeSchema);

export default ProductType;
