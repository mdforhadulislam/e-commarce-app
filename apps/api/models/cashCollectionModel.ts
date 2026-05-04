import mongoose from "mongoose";

const cashCollectionSchema = new mongoose.Schema(
  {
    // Reference to the order
    orderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
      required: true,
    },

    // Amount collected
    amount: {
      type: Number,
      required: true,
    },

    // Who collected the cash (deliveryman)
    collectedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    // When was it collected from customer
    collectedAt: {
      type: Date,
      required: true,
      default: Date.now,
    },

    // Submission to accounts details
    submittedToAccounts: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    submittedAt: {
      type: Date,
      default: null,
    },

    // Confirmation by accounts
    confirmedByAccounts: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    confirmedAt: {
      type: Date,
      default: null,
    },

    // Status of the collection
    status: {
      type: String,
      enum: ["collected", "submitted", "confirmed"],
      default: "collected",
    },

    // Additional notes
    notes: {
      type: String,
      default: "",
    },
  },
  {
    timestamps: true,
  }
);

// Index for faster queries
cashCollectionSchema.index({ collectedBy: 1, status: 1 });
cashCollectionSchema.index({ submittedToAccounts: 1, status: 1 });
cashCollectionSchema.index({ orderId: 1 });

const CashCollection = mongoose.model("CashCollection", cashCollectionSchema);

export default CashCollection;
