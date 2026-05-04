import mongoose from "mongoose";

const purchaseItemSchema = new mongoose.Schema({
  productId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Product",
    required: true,
  },
  productName: {
    type: String,
    required: true,
  },
  quantity: {
    type: Number,
    required: true,
    min: 1,
  },
  purchasePrice: {
    type: Number,
    required: true,
    min: 0,
  },
  profitMargin: {
    type: Number,
    required: true,
    default: 0,
    min: 0,
    max: 100, // Percentage
  },
  sellingPrice: {
    type: Number,
    required: true,
    min: 0,
  },
  totalCost: {
    type: Number,
    required: true,
    min: 0,
  },
});

const purchaseSchema = new mongoose.Schema(
  {
    purchaseNumber: {
      type: String,
      required: true,
      unique: true,
    },
    status: {
      type: String,
      enum: ["requisition", "approved", "purchased", "received", "cancelled"],
      default: "requisition",
    },
    items: [purchaseItemSchema],
    totalAmount: {
      type: Number,
      required: true,
      default: 0,
    },
    supplier: {
      supplierId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Supplier",
      },
      name: {
        type: String,
        required: true,
      },
      contact: String,
      email: String,
      address: String,
    },
    notes: {
      type: String,
      default: "",
    },
    // Workflow tracking
    createdBy: {
      id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
      },
      name: String,
    },
    approvedBy: {
      id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
      name: String,
      at: Date,
      notes: String,
    },
    purchasedBy: {
      id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
      name: String,
      at: Date,
      notes: String,
    },
    receivedBy: {
      id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
      name: String,
      at: Date,
      notes: String,
    },
    // Status history for audit trail
    statusHistory: [
      {
        status: {
          type: String,
          required: true,
        },
        changedAt: {
          type: Date,
          default: Date.now,
        },
        changedBy: {
          id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
          },
          name: {
            type: String,
            required: true,
          },
        },
        notes: {
          type: String,
          default: "",
        },
      },
    ],
    expectedDeliveryDate: {
      type: Date,
    },
    actualDeliveryDate: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

// Auto-generate purchase number before saving
purchaseSchema.pre("save", async function () {
  if (!this.purchaseNumber) {
    const count = await mongoose.model("Purchase").countDocuments();
    this.purchaseNumber = `PO-${String(count + 1).padStart(6, "0")}`;
  }
});

// Calculate total amount before saving
purchaseSchema.pre("save", function (next: any) {
  this.totalAmount = this.items.reduce((sum, item) => sum + item.totalCost, 0);
  next();
});

const Purchase = mongoose.model("Purchase", purchaseSchema);

export default Purchase;
