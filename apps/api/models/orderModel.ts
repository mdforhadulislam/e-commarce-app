import mongoose from "mongoose";

const orderItemSchema = new mongoose.Schema({
  productId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Product",
    required: true,
  },
  name: {
    type: String,
    required: true,
  },
  price: {
    type: Number,
    required: true,
  },
  quantity: {
    type: Number,
    required: true,
    min: 1,
  },
  image: {
    type: String,
  },
  seller: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Seller",
  },
});

const orderSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    items: [orderItemSchema],
    total: {
      type: Number,
      default: 0,
    },
    status: {
      type: String,
      enum: [
        "pending",
        "address_confirmed",
        "confirmed",
        "packed",
        "delivering",
        "delivered",
        "completed",
        "cancelled",
      ],
      default: "pending",
    },
    paymentStatus: {
      type: String,
      enum: ["pending", "paid", "failed", "refunded", "cod_collected"],
      default: "pending",
    },
    paymentMethod: {
      type: String,
      enum: ["stripe", "sslcommerz", "cod"],
      default: "stripe",
    },
    // Comprehensive payment information for all payment gateways
    payment_info: {
      gateway: {
        type: String,
        enum: ["stripe", "sslcommerz", "cod"],
      },
      // Stripe specific fields
      stripe: {
        paymentIntentId: String,
        sessionId: String,
        paymentMethodType: String, // card, ideal, etc.
        cardBrand: String, // visa, mastercard, amex
        cardLast4: String,
        receiptUrl: String,
        chargeId: String,
      },
      // SSLCommerz specific fields
      sslcommerz: {
        transactionId: String, // tran_id
        validationId: String, // val_id
        bankTransactionId: String, // bank_tran_id
        cardType: String, // e.g., VISA-Dutch Bangla, MASTER-BRAC, MOBILEBANKING
        cardIssuer: String, // Bank name
        cardBrand: String, // VISA, MASTER, AMEX, MOBILEB ANKING
        paymentMethod: String, // card, mobile_banking, internet_banking
        cardCategory: String, // VISA, MASTER, AMEX, etc.
        amount: Number,
        storeAmount: Number,
        currency: String,
        currencyType: String,
        currencyAmount: Number,
        conversionRate: Number,
        verifySign: String,
        verifyKey: String,
        riskTitle: String,
        riskLevel: String,
        // Mobile banking specific
        mobileProvider: String, // bKash, Nagad, Rocket, etc.
      },
      // Common fields
      paidAmount: Number,
      currency: String,
      paidAt: Date,
    },
    shippingAddress: {
      street: {
        type: String,
        required: true,
      },
      city: {
        type: String,
        required: true,
      },
      state: {
        type: String,
        required: true,
      },
      country: {
        type: String,
        required: true,
      },
      postalCode: {
        type: String,
        required: true,
      },
    },
    paymentIntentId: {
      type: String,
    },
    stripeSessionId: {
      type: String,
    },
    paidAt: {
      type: Date,
    },
    // Comprehensive status update tracking
    status_updates: {
      address_confirmed: {
        by: {
          id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
          },
          name: String,
        },
        at: Date,
        notes: String,
      },
      order_confirmed: {
        by: {
          id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
          },
          name: String,
        },
        at: Date,
      },
      packed: {
        by: {
          id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
          },
          name: String,
        },
        at: Date,
      },
      delivering: {
        by: {
          id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
          },
          name: String,
        },
        at: Date,
      },
      delivered: {
        by: {
          id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
          },
          name: String,
        },
        at: Date,
      },
      completed: {
        by: {
          id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
          },
          name: String,
        },
        at: Date,
      },
    },
    // Employee assignments
    assignedPacker: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    assignedDeliveryman: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    // COD tracking
    codAmount: {
      type: Number,
      default: 0,
    },
    codCollectedAt: {
      type: Date,
    },
    codCollectedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    codReturnedAt: {
      type: Date,
    },
    codReturnedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    // Status history for audit trail - tracks all status changes with user info
    status_history: [
      {
        status: {
          type: String,
          required: true,
        },
        changed_at: {
          type: Date,
          default: Date.now,
        },
        changed_by: {
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
  },
  { timestamps: true }
);

export default mongoose.model("Order", orderSchema);
