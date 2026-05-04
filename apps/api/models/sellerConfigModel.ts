import mongoose from "mongoose";

const sellerConfigSchema = new mongoose.Schema(
  {
    sellerEnabled: {
      type: Boolean,
      default: true,
    },
    defaultCommissionRate: {
      type: Number,
      default: 15,
      min: 0,
      max: 100,
    },
    minOrderAmount: {
      type: Number,
      default: 0,
      min: 0,
    },
    allowSellerRegistration: {
      type: Boolean,
      default: true,
    },
    requireApproval: {
      type: Boolean,
      default: true,
    },
    maxProductsPerSeller: {
      type: Number,
      min: 0,
    },
  },
  {
    timestamps: true,
  }
);

const SellerConfig = mongoose.model("SellerConfig", sellerConfigSchema);

export default SellerConfig;
