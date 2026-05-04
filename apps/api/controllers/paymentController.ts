import { RequestHandler } from "express";
import Stripe from "stripe";
import asyncHandler from "express-async-handler";
import Order from "../models/orderModel.js";
import { AuthRequestWithBody } from "../types/express.js";

// Initialize Stripe with secret key
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "", {
  apiVersion: "2026-02-25.clover", // Bypass TS error on strictly pinned internal type strings
  typescript: true,
});

interface PaymentIntentBody {
  orderId: string;
  amount: number;
  currency?: string;
}

// @desc    Create payment intent
// @route   POST /api/payments/create-intent
// @access  Private
export const createPaymentIntent: RequestHandler = asyncHandler(
  async (req: AuthRequestWithBody<PaymentIntentBody>, res) => {
    try {
      if (!req.body) {
        res.status(400).json({
          success: false,
          message: "Request body is missing",
        });
        return;
      }

      const { orderId, amount, currency = "usd" } = req.body;

      if (!orderId || !amount) {
        res.status(400).json({
          success: false,
          message: "Order ID and amount are required",
        });
        return;
      }

      const order = await Order.findById(orderId);
      if (!order) {
        res.status(404).json({
          success: false,
          message: "Order not found",
        });
        return;
      }

      if (!order.userId.equals(req.user._id)) {
        res.status(403).json({
          success: false,
          message: "Not authorized to pay for this order",
        });
        return;
      }

      if (order.paymentStatus === "paid") {
        res.status(400).json({
          success: false,
          message: "This order has already been paid",
        });
        return;
      }

      const amountInCents = Math.round(amount * 100);

      const paymentIntent = await stripe.paymentIntents.create({
        amount: amountInCents,
        currency: currency.toLowerCase(),
        metadata: {
          orderId: orderId.toString(),
          userId: req.user._id.toString(),
          userEmail: req.user.email,
        },
        payment_method_types: ["card"],
        description: `Payment for Baby Shop Order #${(orderId as string)
          .slice(-8)
          .toUpperCase()}`,
      });

      res.status(200).json({
        success: true,
        clientSecret: paymentIntent.client_secret,
        paymentIntentId: paymentIntent.id,
        message: "Payment intent created successfully",
      });
    } catch (error: any) {
      console.error("❌ Create payment intent error:", error);
      res.status(500).json({
        success: false,
        message: error.message || "Failed to create payment intent",
      });
    }
  },
);

// @desc    Handle Stripe webhook (for production use)
// @route   POST /api/payments/webhook
// @access  Public (Stripe webhook)
export const handleStripeWebhook: RequestHandler = asyncHandler(
  async (req, res) => {
    // For development - skip signature verification completely
    // In production, you'll need to set up proper raw body handling for webhooks
    if (process.env.NODE_ENV === "production") {
      const sig = req.headers["stripe-signature"];
      const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

      if (!endpointSecret) {
        console.error("❌ STRIPE_WEBHOOK_SECRET not configured");
        res.status(400).send("Webhook secret not configured");
        return;
      }

      try {
        if (!sig) {
          throw new Error("No Stripe signature found");
        }
        // This would need raw body in production
        // note: req.body must be raw buffer for constructEvent
        const event = stripe.webhooks.constructEvent(
          req.body,
          sig,
          endpointSecret,
        );
        // Handle the verified event...
        await processStripeEvent(event);
      } catch (err: any) {
        console.error("❌ Webhook signature verification failed:", err.message);
        res.status(400).send(`Webhook Error: ${err.message}`);
        return;
      }
    } else {
      // Development mode: simulate webhook events for testing
      // Handle common Stripe events even in development
      if (req.body && req.body.type) {
        const event = req.body as Stripe.Event;
        await processStripeEvent(event);
      }
    }

    // Send success response
    res.json({ received: true });
  },
);

async function processStripeEvent(event: Stripe.Event) {
  switch (event.type) {
    case "payment_intent.succeeded":
      const paymentIntent = event.data.object as Stripe.PaymentIntent;

      // Update order status in database
      const orderId = paymentIntent.metadata?.orderId;
      if (orderId) {
        try {
          // Get payment method details from Stripe
          let cardBrand: string | undefined;
          let cardLast4: string | undefined;
          let paymentMethodType: string | undefined;

          // Note: In newer API versions charges might be retrieved differently or expanded
          if (paymentIntent.latest_charge) {
            // In a real webhook, we might need to fetch the charge if not fully expanded
            // For now assume basic fields or leave null if not available immediately
          }

          // Trying to extract from charges array if present in the event object
          // The event object structure depends on API version
          if (
            (paymentIntent as any).charges &&
            (paymentIntent as any).charges.data &&
            (paymentIntent as any).charges.data[0]
          ) {
            const charge = (paymentIntent as any).charges.data[0];
            if (charge.payment_method_details) {
              paymentMethodType = charge.payment_method_details.type;
              if (charge.payment_method_details.card) {
                cardBrand = charge.payment_method_details.card.brand;
                cardLast4 = charge.payment_method_details.card.last4;
              }
            }
          }

          await Order.findByIdAndUpdate(
            orderId,
            {
              paymentStatus: "paid",
              status: "confirmed", // Auto confirm paid orders?
              paymentMethod: "stripe",
              paymentIntentId: paymentIntent.id,
              payment_info: {
                gateway: "stripe",
                stripe: {
                  paymentIntentId: paymentIntent.id,
                  paymentMethodType: paymentMethodType,
                  cardBrand: cardBrand,
                  cardLast4: cardLast4,
                  receiptUrl: (paymentIntent as any).charges?.data?.[0]
                    ?.receipt_url,
                  chargeId: (paymentIntent as any).charges?.data?.[0]?.id,
                },
                paidAmount: paymentIntent.amount / 100,
                currency: paymentIntent.currency.toUpperCase(),
                paidAt: new Date(),
              },
            },
            { new: true },
          );
        } catch (error) {
          console.error("❌ Failed to update order via webhook:", error);
        }
      }
      break;

    case "payment_intent.payment_failed":
      break;

    case "payment_intent.created":
      break;

    default:
    // console.log(`Unhandled event type ${event.type}`);
  }
}
