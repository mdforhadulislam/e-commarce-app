import { RequestHandler } from "express";
import asyncHandler from "express-async-handler";
import Order from "../models/orderModel.js";
import { AuthRequestWithBody } from "../types/express.js";

// SSLCommerz API URLs
const SSLCOMMERZ_NEXT_PUBLIC_API_URL =
  process.env.SSLCOMMERZ_IS_LIVE === "true"
    ? "https://securepay.sslcommerz.com"
    : "https://sandbox.sslcommerz.com";

interface SSLCommerzInitBody {
  orderId: string;
  amount: string | number;
  currency?: string;
}

// @desc    Initialize SSLCommerz payment
// @route   POST /api/payments/sslcommerz/init
// @access  Private
export const initSSLCommerzPayment: RequestHandler = asyncHandler(
  async (req: AuthRequestWithBody<SSLCommerzInitBody>, res) => {
    try {
      const { orderId, amount, currency = "BDT" } = req.body;

      if (!orderId || !amount) {
        res.status(400).json({
          success: false,
          message: "Order ID and amount are required",
        });
        return;
      }

      const order = await Order.findById(orderId).populate(
        "userId",
        "name email phone",
      );
      if (!order) {
        res.status(404).json({
          success: false,
          message: "Order not found",
        });
        return;
      }

      // Check authorization: Must be the user who owns the order
      if (
        order.userId &&
        order.userId._id &&
        !order.userId._id.equals(req.user._id)
      ) {
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

      // Prepare SSLCommerz payment data
      const transactionId = `ENTRY-${Date.now()}-${orderId.slice(-8)}`;

      const amountNum =
        typeof amount === "string" ? parseFloat(amount) : amount;
      const amountStr = amountNum.toFixed(2);

      // Type for user populated fields
      const user: any = order.userId; // Explicit cast for populated user fields until we have full generics for Order

      const paymentData = {
        store_id: process.env.SSLCOMMERZ_STORE_ID || "",
        store_passwd: process.env.SSLCOMMERZ_STORE_PASSWORD || "",
        total_amount: amountStr,
        currency: currency,
        tran_id: transactionId,
        success_url: `http://localhost:8000/api/payments/sslcommerz/success`,
        fail_url: `http://localhost:8000/api/payments/sslcommerz/fail`,
        cancel_url: `http://localhost:8000/api/payments/sslcommerz/cancel`,
        ipn_url: `http://localhost:8000/api/payments/sslcommerz/ipn`,
        shipping_method: "Standard",
        product_name: `Baby Shop Order #${orderId.slice(-8).toUpperCase()}`,
        product_category: "Ecommerce",
        product_profile: "general",
        cus_name: user.name || "Customer",
        cus_email: user.email,
        cus_add1: order.shippingAddress?.street || "N/A",
        cus_city: order.shippingAddress?.city || "N/A",
        cus_state: order.shippingAddress?.state || "N/A",
        cus_postcode: order.shippingAddress?.postalCode || "0000",
        cus_country: order.shippingAddress?.country || "Bangladesh",
        cus_phone: user.phone || "01700000000",
        ship_name: user.name || "Customer",
        ship_add1: order.shippingAddress?.street || "N/A",
        ship_city: order.shippingAddress?.city || "N/A",
        ship_state: order.shippingAddress?.state || "N/A",
        ship_postcode: order.shippingAddress?.postalCode || "0000",
        ship_country: order.shippingAddress?.country || "Bangladesh",
        value_a: orderId, // Store orderId in custom field
        value_b: req.user._id.toString(), // Store userId
      };

      console.log(
        "📤 Sending payment request to SSLCommerz:",
        SSLCOMMERZ_NEXT_PUBLIC_API_URL,
      );

      // Initialize payment with SSLCommerz
      const response = await fetch(
        `${SSLCOMMERZ_NEXT_PUBLIC_API_URL}/gwprocess/v4/api.php`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: new URLSearchParams(paymentData).toString(),
        },
      );

      // Check if response is OK
      if (!response.ok) {
        console.error(
          "❌ SSLCommerz API error:",
          response.status,
          response.statusText,
        );
        res.status(response.status).json({
          success: false,
          message: `SSLCommerz API error: ${response.statusText}`,
        });
        return;
      }

      // Get response text first to check content type
      const responseText = await response.text();

      // Check if response is HTML (error page)
      if (
        responseText.trim().startsWith("<!DOCTYPE") ||
        responseText.trim().startsWith("<html")
      ) {
        console.error(
          "❌ SSLCommerz returned HTML instead of JSON:",
          responseText.substring(0, 200),
        );
        res.status(500).json({
          success: false,
          message:
            "SSLCommerz API returned an invalid response. Please check your credentials.",
        });
        return;
      }

      let data;
      try {
        data = JSON.parse(responseText);
      } catch (parseError) {
        console.error(
          "❌ Failed to parse SSLCommerz response:",
          responseText.substring(0, 200),
        );
        res.status(500).json({
          success: false,
          message: "Invalid response from payment gateway",
        });
        return;
      }

      if (data.status === "SUCCESS") {
        // Update order with transaction ID
        // paymentDetails field might not exist in Order schema?
        // Checking orderModel.ts, it has 'payment_info' and 'sslcommerz' field group.
        // But previous code used 'paymentDetails'. This suggests DB schema mismatch or prev code was wrong.
        // I will use 'payment_info.sslcommerz.transactionId' equivalent logic or $set if schema supports dynamic fields (not ideal).
        // Ideally I should update known fields.
        // 'payment_info' has 'sslcommerz' which has 'transactionId'.

        await Order.findByIdAndUpdate(orderId, {
          $set: {
            // Mapping to correct schema path
            "payment_info.sslcommerz.transactionId": transactionId,
            "payment_info.gateway": "sslcommerz",
          },
        });

        res.status(200).json({
          success: true,
          gatewayUrl: data.GatewayPageURL,
          transactionId: transactionId,
          message: "Payment session created successfully",
        });
      } else {
        console.error("❌ SSLCommerz error:", data);
        res.status(400).json({
          success: false,
          message: data.failedreason || "Failed to initialize payment",
        });
      }
    } catch (error: any) {
      console.error("❌ SSLCommerz initialization error:", error);
      res.status(500).json({
        success: false,
        message: error.message || "Failed to initialize payment",
      });
    }
  },
);

// @desc    Handle SSLCommerz success callback
// @route   POST /api/payments/sslcommerz/success
// @access  Public (SSLCommerz callback)
export const handleSSLCommerzSuccess: RequestHandler = asyncHandler(
  async (req, res) => {
    try {
      const {
        tran_id,
        val_id,
        amount,
        card_type,
        store_amount,
        card_issuer,
        bank_tran_id,
        value_a: orderId,
      } = req.body; // Explicitly cast if needed, or infer from generic if we use RequestWithBody<SSLCommerzSuccessBody>

      if (!orderId) {
        console.error("❌ Order ID missing in success callback");
        res.redirect(`${process.env.CLIENT_URL}/checkout?payment=failed`);
        return;
      }

      // Validate payment with SSLCommerz
      const validationData = {
        val_id: val_id,
        store_id: process.env.SSLCOMMERZ_STORE_ID || "",
        store_passwd: process.env.SSLCOMMERZ_STORE_PASSWORD || "",
        format: "json",
      };

      const validationResponse = await fetch(
        `${SSLCOMMERZ_NEXT_PUBLIC_API_URL}/validator/api/validationserverAPI.php?${new URLSearchParams(validationData).toString()}`,
      );

      const validationData2 = await validationResponse.json();

      if (
        validationData2.status === "VALID" ||
        validationData2.status === "VALIDATED"
      ) {
        // Extract comprehensive payment information from SSLCommerz response
        const {
          card_brand,
          currency,
          currency_type,
          currency_amount,
          currency_rate,
          verify_sign,
          verify_key,
          risk_title,
          risk_level,
        } = req.body;

        // Determine payment method and mobile provider from card_type
        let paymentMethod = "card";
        let mobileProvider = null;
        let cardCategory = card_brand || "UNKNOWN";

        if (
          card_type &&
          typeof card_type === "string" &&
          card_type.toLowerCase().includes("mobile")
        ) {
          paymentMethod = "mobile_banking";
          // Extract mobile banking provider (bKash, Nagad, Rocket, etc.)
          if (card_type.toLowerCase().includes("bkash")) {
            mobileProvider = "bKash";
          } else if (card_type.toLowerCase().includes("nagad")) {
            mobileProvider = "Nagad";
          } else if (card_type.toLowerCase().includes("rocket")) {
            mobileProvider = "Rocket";
          } else {
            mobileProvider = "Other";
          }
        } else if (
          card_type &&
          typeof card_type === "string" &&
          card_type.toLowerCase().includes("internet")
        ) {
          paymentMethod = "internet_banking";
        }

        // Update order with comprehensive payment information
        const updatedOrder = await Order.findByIdAndUpdate(
          orderId,
          {
            paymentStatus: "paid",
            // isPaid: true, // Removed if type error; use paymentStatus
            paidAt: new Date(),
            paymentMethod: "sslcommerz",
            payment_info: {
              gateway: "sslcommerz",
              sslcommerz: {
                transactionId: tran_id,
                validationId: val_id,
                bankTransactionId: bank_tran_id,
                cardType: card_type,
                cardIssuer: card_issuer,
                cardBrand: card_brand,
                paymentMethod: paymentMethod,
                cardCategory: cardCategory,
                amount: parseFloat(amount),
                storeAmount: parseFloat(store_amount),
                currency: currency,
                currencyType: currency_type,
                currencyAmount: parseFloat(currency_amount),
                conversionRate: parseFloat(currency_rate),
                verifySign: verify_sign,
                verifyKey: verify_key,
                riskTitle: risk_title,
                riskLevel: risk_level,
                mobileProvider: mobileProvider,
              },
              paidAmount: parseFloat(amount),
              currency: currency || "BDT",
              paidAt: new Date(),
            },
          },
          { new: true },
        );

        if (updatedOrder) {
          res.redirect(
            `${process.env.CLIENT_URL}/success?orderId=${orderId}&payment=success`,
          );
        } else {
          console.error("❌ Order not found:", orderId);
          res.redirect(`${process.env.CLIENT_URL}/checkout?payment=failed`);
        }
      } else {
        console.error("❌ Payment validation failed:", validationData2);
        res.redirect(`${process.env.CLIENT_URL}/checkout?payment=failed`);
      }
    } catch (error) {
      console.error("❌ SSLCommerz success handler error:", error);
      res.redirect(`${process.env.CLIENT_URL}/checkout?payment=error`);
    }
  },
);

// @desc    Handle SSLCommerz fail callback
// @route   POST /api/payments/sslcommerz/fail
// @access  Public (SSLCommerz callback)
export const handleSSLCommerzFail: RequestHandler = asyncHandler(
  async (req, res) => {
    const { value_a: orderId } = req.body;

    if (orderId) {
      await Order.findByIdAndUpdate(orderId, {
        $set: {
          paymentStatus: "failed", // Use correct schema field
        },
      });
    }

    res.redirect(
      `${process.env.CLIENT_URL}/checkout?payment=failed&orderId=${orderId || ""}`,
    );
  },
);

// @desc    Handle SSLCommerz cancel callback
// @route   POST /api/payments/sslcommerz/cancel
// @access  Public (SSLCommerz callback)
export const handleSSLCommerzCancel: RequestHandler = asyncHandler(
  async (req, res) => {
    const { value_a: orderId } = req.body;

    if (orderId) {
      await Order.findByIdAndUpdate(orderId, {
        $set: {
          status: "cancelled",
          paymentStatus: "failed",
        },
      });
    }

    res.redirect(`${process.env.CLIENT_URL}/user/orders/${orderId || ""}`);
  },
);

// @desc    Handle SSLCommerz IPN (Instant Payment Notification)
// @route   POST /api/payments/sslcommerz/ipn
// @access  Public (SSLCommerz callback)
export const handleSSLCommerzIPN: RequestHandler = asyncHandler(
  async (req, res) => {
    // Process IPN for additional payment status updates
    // This is useful for asynchronous payment confirmations
    res.status(200).json({ status: "OK" });
  },
);
