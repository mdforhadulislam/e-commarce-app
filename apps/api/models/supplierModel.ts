import mongoose from "mongoose";

const supplierSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Supplier name is required"],
      trim: true,
    },
    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true,
      lowercase: true,
      trim: true,
    },
    contact: {
      type: String,
      trim: true,
    },
    address: {
      type: String,
      trim: true,
    },
    paymentSystem: {
      type: String,
      enum: ["cash", "bank-transfer", "check", "credit", "online", "other"],
      default: "cash",
    },
    paymentDetails: {
      type: String,
      trim: true,
    },
    taxId: {
      type: String,
      trim: true,
    },
    website: {
      type: String,
      trim: true,
    },
    notes: {
      type: String,
      trim: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    createdBy: {
      id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
      },
      name: String,
    },
  },
  {
    timestamps: true,
  }
);

// Index for faster searches
supplierSchema.index({ name: 1, email: 1 });

const Supplier = mongoose.model("Supplier", supplierSchema);

export default Supplier;
