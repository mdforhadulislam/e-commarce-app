import mongoose from "mongoose";

const productBannerSchema = new mongoose.Schema(
  {
    image: {
      type: String,
      required: [true, "Image URL is required"],
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
    buttonTitle: {
      type: String,
      trim: true,
    },
    buttonHref: {
      type: String,
      trim: true,
      required: function (this: any) {
        return !!this.buttonTitle;
      },
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    order: {
      type: Number,
      default: 0,
      index: true,
    },
    productType: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ProductType",
      required: [true, "Product Type is required"],
    },
  },
  {
    timestamps: true,
  },
);

const ProductBanner = mongoose.model("ProductBanner", productBannerSchema);

export default ProductBanner;
