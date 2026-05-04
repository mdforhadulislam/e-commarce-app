import mongoose from "mongoose";

const subscriptionSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      validate: {
        validator: function (email) {
          return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
        },
        message: "Invalid email format",
      },
    },
    source: {
      type: String,
      enum: ["homepage_modal", "footer", "popup", "other"],
      default: "other",
    },
    preferences: {
      newsletter: {
        type: Boolean,
        default: true,
      },
      promotions: {
        type: Boolean,
        default: true,
      },
      newProducts: {
        type: Boolean,
        default: true,
      },
    },
    status: {
      type: String,
      enum: ["active", "unsubscribed"],
      default: "active",
    },
    unsubscribedAt: {
      type: Date,
      default: null,
    },
    subscribedAt: {
      type: Date,
      default: Date.now,
    },
    ipAddress: {
      type: String,
      default: null,
    },
    userAgent: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: true,
  },
);

// Index for faster queries
subscriptionSchema.index({ status: 1 });
subscriptionSchema.index({ createdAt: -1 });

const Subscription = mongoose.model("Subscription", subscriptionSchema);

export default Subscription;
