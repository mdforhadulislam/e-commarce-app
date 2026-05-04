import mongoose from "mongoose";

const baseConfigSchema = new mongoose.Schema(
  {
    sidebar: {
      type: Boolean,
      default: true,
      required: true,
    },
    banner: {
      type: Boolean,
      default: true,
      required: true,
    },
    showAds: {
      type: Boolean,
      default: true,
      required: true,
    },
    showCategoryMenu: {
      type: Boolean,
      default: true,
      required: true,
    },
    search: {
      enabled: {
        type: Boolean,
        default: true,
      },
      voice: {
        type: Boolean,
        default: true,
      },
      image: {
        type: Boolean,
        default: true,
      },
    },
    revalidationTime: {
      type: Number,
      default: 60, // in seconds
      required: true,
    },
    bottomHeader: {
      enabled: {
        type: Boolean,
        default: true,
      },
      categoryMenu: {
        type: Boolean,
        default: true,
      },
      navList: {
        type: Boolean,
        default: true,
      },
    },
  },
  {
    timestamps: true,
  }
);

const BaseConfig = mongoose.model("BaseConfig", baseConfigSchema);

export default BaseConfig;
