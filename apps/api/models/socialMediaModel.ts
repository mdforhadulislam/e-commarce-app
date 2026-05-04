import mongoose from "mongoose";

const socialMediaSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      unique: true,
    },
    platform: {
      type: String,
      required: true,
      enum: [
        "facebook",
        "instagram",
        "twitter",
        "linkedin",
        "youtube",
        "tiktok",
        "pinterest",
        "whatsapp",
        "telegram",
        "other",
      ],
    },
    href: {
      type: String,
      required: true,
    },
    icon: {
      type: String,
      default: "",
    },
    displayOrder: {
      type: Number,
      default: 0,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    // Additional sensitive data fields
    apiKey: {
      type: String,
      default: "",
    },
    apiSecret: {
      type: String,
      default: "",
    },
    accessToken: {
      type: String,
      default: "",
    },
    webhookUrl: {
      type: String,
      default: "",
    },
    description: {
      type: String,
      default: "",
    },
  },
  {
    timestamps: true,
  }
);

const SocialMedia = mongoose.model("SocialMedia", socialMediaSchema);

export default SocialMedia;
