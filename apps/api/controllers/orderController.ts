import { RequestHandler } from "express";
import asyncHandler from "express-async-handler";
import Order from "../models/orderModel.js";
import Cart from "../models/cartModel.js";
import User from "../models/userModel.js";
import { sendOrderConfirmationEmail } from "../utils/emailService.js";
import { notificationService } from "../services/notificationService.js";
import {
  RequestWithBody,
  RequestWithQuery,
  PaginationQuery,
} from "../types/express.js";

// Interfaces
interface CartItem {
  _id: string; // This usually comes from frontend as product._id
  name: string;
  price: number;
  quantity: number;
  image?: string;
  seller?: string;
  productId?: string; // Mapped internally
}

interface ShippingAddress {
  street: string;
  city: string;
  country: string;
  postalCode: string;
  state?: string;
}

interface CreateOrderBody {
  items: CartItem[];
  shippingAddress: ShippingAddress;
}

interface UpdateStatusBody {
  status: string;
  paymentIntentId?: string;
  stripeSessionId?: string;
}

interface UpdatePaymentStatusBody {
  status: string;
  paymentIntentId?: string;
  stripeSessionId?: string;
}

interface AdminUpdateOrderBody {
  status?: string;
  paymentStatus?: string;
  totalAmount?: number;
  items?: CartItem[];
  shippingAddress?: ShippingAddress;
}

interface OrderQuery extends PaginationQuery {
  status?: string;
  paymentStatus?: string;
  sortOrder?: string;
}

interface SearchProductsQuery {
  search: string;
  limit?: string;
  [key: string]: any;
}

// @desc    Get all orders for a user
// @route   GET /api/orders
// @access  Private
export const getOrders: RequestHandler = asyncHandler(async (req, res) => {
  const orders = await Order.find({ userId: req.user._id }).populate(
    "items.productId",
  );
  res.json(orders);
});

// @desc    Get order by ID
// @route   GET /api/orders/:id
// @access  Private
export const getOrderById: RequestHandler = asyncHandler(async (req, res) => {
  const order = await Order.findById(req.params.id).populate("items.productId");

  if (
    order &&
    (req.user.role === "admin" ||
      order.userId.toString() === req.user._id.toString())
  ) {
    res.json(order);
  } else {
    res.status(404);
    throw new Error("Order not found");
  }
});

export const createCODOrder: RequestHandler = asyncHandler(
  async (req: RequestWithBody<CreateOrderBody>, res) => {
    const { items, shippingAddress } = req.body;

    // Validate that items are provided
    if (!items || !Array.isArray(items) || items.length === 0) {
      res.status(400);
      throw new Error("Cart items are required");
    }

    // Validate shipping address
    if (
      !shippingAddress ||
      !shippingAddress.street ||
      !shippingAddress.city ||
      !shippingAddress.country ||
      !shippingAddress.postalCode
    ) {
      res.status(400);
      throw new Error(
        "Shipping address is required with all fields (street, city, country, postalCode)",
      );
    }

    // Validate each item structure
    const validItems = items.map((item) => {
      if (!item._id || !item.name || !item.price || !item.quantity) {
        res.status(400);
        throw new Error("Invalid item structure");
      }
      return {
        productId: item._id,
        name: item.name,
        price: item.price,
        quantity: item.quantity,
        image: item.image,
        seller: item.seller,
      };
    });

    // Calculate subtotal (items only)
    const subtotal = validItems.reduce((acc, item) => {
      return acc + item.price * item.quantity;
    }, 0);

    // Calculate shipping (free over threshold, otherwise from env/15)
    const freeDeliveryThreshold = parseFloat(
      process.env.FREE_DELIVERY_THRESHOLD || "999",
    );
    const shipping =
      subtotal > freeDeliveryThreshold
        ? 0
        : parseFloat(process.env.NEXT_PUBLIC_SHIPPING_COST || "15");

    // Calculate tax (0% default, can be configured via env)
    const taxRate = parseFloat(process.env.TAX_RATE || "0");
    const tax = subtotal * taxRate;

    // Calculate final total
    const total = subtotal + shipping + tax;

    // Create COD order with "confirmed" status
    const order = await Order.create({
      userId: req.user._id,
      items: validItems,
      total,
      status: "confirmed",
      paymentStatus: "pending",
      paymentMethod: "cod",
      shippingAddress,
      codAmount: total, // Set COD amount to total
      // Initialize status history
      status_history: [
        {
          status: "confirmed",
          changed_at: new Date(),
          changed_by: {
            id: req.user._id,
            name: req.user.name || req.user.email,
          },
          notes: "COD order created and confirmed",
        },
      ],
    });

    // Create in-app notification for order placed
    try {
      await notificationService.notifyOrderPlaced(req.user._id, order);
    } catch (notifError) {
      console.error("❌ Failed to create notification:", notifError);
      // Don't fail order creation if notification fails
    }

    // Send order confirmation email
    try {
      const user = await User.findById(req.user._id);
      const emailResult = await sendOrderConfirmationEmail({
        userEmail: user.email,
        userName: user.name || user.email,
        order: {
          _id: order._id.toString(),
          items: validItems,
          total: order.total,
          status: order.status,
          shippingAddress: order.shippingAddress,
        },
      });
    } catch (emailError) {
      console.error(
        "❌ Failed to send COD order confirmation email:",
        emailError,
      );
      // Don't fail order creation if email fails
    }

    res.status(201).json({
      success: true,
      message: "COD order created successfully",
      data: order,
    });
  },
);

// @desc    Create order from cart
// @route   POST /api/orders
// @access  Private
export const createOrderFromCart: RequestHandler = asyncHandler(
  async (req: RequestWithBody<CreateOrderBody>, res) => {
    const { items, shippingAddress } = req.body;

    // Validate that items are provided
    if (!items || !Array.isArray(items) || items.length === 0) {
      res.status(400);
      throw new Error("Cart items are required");
    }

    // Validate shipping address
    if (
      !shippingAddress ||
      !shippingAddress.street ||
      !shippingAddress.city ||
      !shippingAddress.country ||
      !shippingAddress.postalCode
    ) {
      res.status(400);
      throw new Error(
        "Shipping address is required with all fields (street, city, country, postalCode)",
      );
    }

    // Validate each item structure
    const validItems = items.map((item) => {
      if (!item._id || !item.name || !item.price || !item.quantity) {
        res.status(400);
        throw new Error("Invalid item structure");
      }
      return {
        productId: item._id,
        name: item.name,
        price: item.price,
        quantity: item.quantity,
        image: item.image,
        seller: item.seller,
      };
    });

    // Calculate subtotal (items only)
    const subtotal = validItems.reduce((acc, item) => {
      return acc + item.price * item.quantity;
    }, 0);

    // Calculate shipping (free over threshold, otherwise from env/15)
    const freeDeliveryThreshold = parseFloat(
      process.env.FREE_DELIVERY_THRESHOLD || "999",
    );
    const shipping =
      subtotal > freeDeliveryThreshold
        ? 0
        : parseFloat(process.env.NEXT_PUBLIC_SHIPPING_COST || "15");

    // Calculate tax (0% default, can be configured via env)
    const taxRate = parseFloat(process.env.TAX_RATE || "0");
    const tax = subtotal * taxRate;

    // Calculate final total
    const total = subtotal + shipping + tax;

    // Create order with "pending" status (will be updated to "paid" after successful payment)
    const order = await Order.create({
      userId: req.user._id,
      items: validItems,
      total,
      status: "pending",
      paymentStatus: "pending",
      paymentMethod: "stripe", // Default to stripe, will be updated for COD
      shippingAddress,
      // Initialize COD amount for potential COD orders
      codAmount: 0,
      // Initialize status history
      status_history: [
        {
          status: "pending",
          changed_at: new Date(),
          changed_by: {
            id: req.user._id,
            name: req.user.name || req.user.email,
          },
          notes: "Order created",
        },
      ],
    });

    // Create in-app notification for order placed
    try {
      await notificationService.notifyOrderPlaced(req.user._id, order);
    } catch (notifError) {
      console.error("❌ Failed to create notification:", notifError);
      // Don't fail order creation if notification fails
    }

    // Send order confirmation email
    try {
      const user = await User.findById(req.user._id);
      const emailResult = await sendOrderConfirmationEmail({
        userEmail: user.email,
        userName: user.name || user.email,
        order: {
          _id: order._id.toString(),
          items: validItems,
          total: order.total,
          status: order.status,
          shippingAddress: order.shippingAddress,
        },
      });
    } catch (emailError) {
      console.error("❌ Failed to send order confirmation email:", emailError);
      // Don't fail the order creation if email fails
    }

    res.status(201).json({
      success: true,
      order,
      message: "Order created successfully",
    });
  },
);

// @desc    Update order status
// @route   PUT /api/orders/:id/status
// @access  Private
export const updateOrderStatus: RequestHandler = asyncHandler(
  async (req: RequestWithBody<UpdateStatusBody>, res) => {
    if (!req.body) {
      res.status(400).json({
        success: false,
        message: "Request body is missing",
      });
      return;
    }

    const { status, paymentIntentId, stripeSessionId } = req.body;

    // Validate status
    const validStatuses = [
      "pending",
      "address_confirmed",
      "confirmed",
      "packed",
      "delivering",
      "delivered",
      "completed",
      "cancelled",
    ];
    if (!status || !validStatuses.includes(status)) {
      res.status(400);
      throw new Error(
        "Invalid status. Must be one of: pending, address_confirmed, confirmed, packed, delivering, delivered, completed, cancelled",
      );
    }

    const order = await Order.findById(req.params.id);

    if (!order) {
      res.status(404);
      throw new Error("Order not found");
    }

    // Log order details for debugging

    // Check authorization based on order status and user role
    // - Users can only update their own orders when status is "pending"
    // - Admins can update any order at any time
    // - Employees can update orders based on their role and workflow permissions
    // - Webhook calls (no req.user) are always allowed
    if (req.user) {
      const isOwner = order.userId.toString() === req.user._id.toString();
      const isAdmin = req.user.role === "admin";
      const isEmployee = req.user.role === "employee";
      const isPending = order.status === "pending";

      // If user is not admin/employee and (not owner OR order is not pending), deny access
      if (!isAdmin && !isEmployee && (!isOwner || !isPending)) {
        res.status(403);
        throw new Error(
          isPending
            ? "Not authorized to update this order"
            : "Order status can only be updated by admin or authorized employees after payment",
        );
      }

      // For employees, check if they have permission for this status change
      if (isEmployee && !isAdmin) {
        const employeeRole = req.user.employee_role;
        const currentStatus = order.status;

        // Define allowed status transitions for each employee role
        // Cast employeeRole to string to query the object safely
        const allowedTransitions: Record<
          string,
          { from: string[]; to: string[] }
        > = {
          packer: {
            from: ["confirmed", "processing"],
            to: ["processing", "packed"],
          },
          deliveryman: {
            from: ["packed", "delivering"],
            to: ["delivering", "delivered"],
          },
          accounts: {
            from: ["delivered"],
            to: ["completed"],
          },
          incharge: {
            from: ["confirmed", "packed", "delivering", "delivered"],
            to: [
              "confirmed",
              "packed",
              "delivering",
              "delivered",
              "completed",
              "cancelled",
            ],
          },
        };

        const allowedForRole = allowedTransitions[employeeRole];
        if (
          !allowedForRole ||
          !allowedForRole.from.includes(currentStatus) ||
          !allowedForRole.to.includes(status)
        ) {
          res.status(403);
          throw new Error(
            `${employeeRole} role cannot change order from ${currentStatus} to ${status}`,
          );
        }
      }
    }

    // Get the order first to ensure status_updates exists
    const existingOrder = await Order.findById(req.params.id);
    if (!existingOrder) {
      res.status(404).json({ message: "Order not found" });
      return;
    }

    // Initialize status_updates if it doesn't exist
    if (!existingOrder.status_updates) {
      existingOrder.status_updates = {};
    }

    // Prepare update object
    const updateData: any = {
      status,
      updatedAt: new Date(),
    };

    // Add status-specific tracking to status_updates object
    if (req.user) {
      const userName = req.user.name || req.user.email;
      const statusUpdateField = `status_updates.${status}`;

      switch (status) {
        case "address_confirmed":
          updateData[`status_updates.address_confirmed.by.id`] = req.user._id;
          updateData[`status_updates.address_confirmed.by.name`] = userName;
          updateData[`status_updates.address_confirmed.at`] = new Date();
          break;
        case "confirmed":
          updateData[`status_updates.order_confirmed.by.id`] = req.user._id;
          updateData[`status_updates.order_confirmed.by.name`] = userName;
          updateData[`status_updates.order_confirmed.at`] = new Date();

          // Reduce product stock and increase sold when order is confirmed
          if (existingOrder.status !== "confirmed") {
            const Product = (await import("../models/productModel.js")).default;
            for (const item of existingOrder.items) {
              await Product.findByIdAndUpdate(
                item.productId,
                {
                  $inc: {
                    stock: -item.quantity,
                    sold: item.quantity,
                  },
                },
                { new: true },
              );
            }
          }
          break;
        case "packed":
          updateData[`${statusUpdateField}.by.id`] = req.user._id;
          updateData[`${statusUpdateField}.by.name`] = userName;
          updateData[`${statusUpdateField}.at`] = new Date();
          break;
        case "delivering":
          updateData[`${statusUpdateField}.by.id`] = req.user._id;
          updateData[`${statusUpdateField}.by.name`] = userName;
          updateData[`${statusUpdateField}.at`] = new Date();
          break;
        case "delivered":
          updateData[`${statusUpdateField}.by.id`] = req.user._id;
          updateData[`${statusUpdateField}.by.name`] = userName;
          updateData[`${statusUpdateField}.at`] = new Date();
          break;
        case "completed":
          updateData[`${statusUpdateField}.by.id`] = req.user._id;
          updateData[`${statusUpdateField}.by.name`] = userName;
          updateData[`${statusUpdateField}.at`] = new Date();
          updateData.paymentStatus = "paid"; // Mark as paid when completed
          break;
      }
    }

    // Add to status history
    if (req.user) {
      const userName = req.user.name || req.user.email;
      const statusHistoryEntry = {
        status,
        changed_at: new Date(),
        changed_by: {
          id: req.user._id,
          name: userName,
        },
        notes: "",
      };

      updateData.$push = { status_history: statusHistoryEntry };
    }

    // Use findByIdAndUpdate to avoid full document validation
    const updatedOrder = await Order.findByIdAndUpdate(
      req.params.id,
      updateData,
      {
        new: true,
        runValidators: false, // Disable validation to avoid shipping address issues
      },
    ).populate("userId", "name email");

    // Create in-app notifications for status changes
    if (updatedOrder) {
      try {
        const userId =
          (updatedOrder.userId && (updatedOrder.userId as any)._id) ||
          updatedOrder.userId;

        if (status === "confirmed") {
          await notificationService.notifyOrderConfirmed(userId, updatedOrder);
        } else if (status === "shipped") {
          await notificationService.notifyOrderShipped(userId, updatedOrder);
        } else if (status === "delivered") {
          await notificationService.notifyOrderDelivered(userId, updatedOrder);
        }
      } catch (notifError) {
        console.error("❌ Failed to create status notification:", notifError);
      }
    }

    // Send email notification only when order is delivered
    if (updatedOrder && status === "delivered") {
      try {
        const user = updatedOrder.userId as any;
        const emailResult = await sendOrderConfirmationEmail({
          userEmail: user.email,
          userName: user.name || user.email,
          order: {
            _id: updatedOrder._id.toString(),
            items: updatedOrder.items,
            total: updatedOrder.total,
            status: updatedOrder.status,
            shippingAddress: updatedOrder.shippingAddress,
          },
        });
      } catch (emailError) {
        console.error(`❌ Failed to send order delivery email:`, emailError);
        // Don't fail the order update if email fails
      }
    }

    res.json({
      success: true,
      order: updatedOrder,
      message: `Order status updated to ${status}`,
    });
  },
);

// @desc    Update order payment status (webhook only)
// @route   PUT /api/orders/:id/webhook-status
// @access  Public (called by webhooks)
export const updateOrderPaymentStatus: RequestHandler = asyncHandler(
  async (req: RequestWithBody<UpdatePaymentStatusBody>, res) => {
    if (!req.body) {
      res.status(400).json({
        success: false,
        message: "Request body is missing",
      });
      return;
    }

    const { status, paymentIntentId, stripeSessionId } = req.body;

    const order = await Order.findById(req.params.id);

    if (!order) {
      res.status(404);
      throw new Error("Order not found");
    }

    // Prepare update object based on what status was sent
    const updateData: any = {
      updatedAt: new Date(),
    };

    // If status is "paid", update paymentStatus field (not status field)
    if (status === "paid") {
      updateData.paymentStatus = "paid";
      updateData.paidAt = new Date();
      updateData.paymentMethod = "stripe"; // Set payment method

      // Store comprehensive Stripe payment information
      updateData.payment_info = {
        gateway: "stripe",
        stripe: {
          paymentIntentId: paymentIntentId || null,
          sessionId: stripeSessionId || null,
        },
        paidAt: new Date(),
      };

      if (paymentIntentId) {
        updateData.paymentIntentId = paymentIntentId;
      }
      if (stripeSessionId) {
        updateData.stripeSessionId = stripeSessionId;
      }
    } else if (["pending", "failed", "refunded"].includes(status)) {
      // Handle other payment statuses
      updateData.paymentStatus = status;
    } else {
      // For order status updates from webhook (shouldn't happen but handle anyway)
      const validStatuses = [
        "pending",
        "confirmed",
        "processing",
        "shipped",
        "delivered",
        "cancelled",
      ];
      if (validStatuses.includes(status)) {
        updateData.status = status;
      }
    }

    // Use findByIdAndUpdate to avoid full document validation
    const updatedOrder = await Order.findByIdAndUpdate(
      req.params.id,
      updateData,
      {
        new: true,
        runValidators: false,
      },
    ).populate("userId", "name email");

    // Create in-app notification for payment success
    if (updatedOrder && updatedOrder.paymentStatus === "paid") {
      try {
        const userId =
          (updatedOrder.userId && (updatedOrder.userId as any)._id) ||
          updatedOrder.userId;
        await notificationService.notifyPaymentSuccess(userId, updatedOrder);
      } catch (notifError) {
        console.error("❌ Failed to create payment notification:", notifError);
      }
    }

    res.json({
      success: true,
      order: updatedOrder,
      message: `Order payment status updated successfully`,
    });
  },
);

// @desc    Update complete order (admin only)
// @route   PUT /api/orders/:id
// @access  Private (Admin)
export const updateOrder: RequestHandler = asyncHandler(
  async (req: RequestWithBody<AdminUpdateOrderBody>, res) => {
    const { status, paymentStatus, totalAmount, items, shippingAddress } =
      req.body;

    const order = await Order.findById(req.params.id);

    if (!order) {
      res.status(404);
      throw new Error("Order not found");
    }

    // Role-based access control
    const isAdmin = req.user.role === "admin";
    const isEmployee = req.user.role === "employee";
    const employeeRole = req.user.employee_role;

    // Check permissions based on role
    if (!isAdmin && !isEmployee) {
      res.status(403);
      throw new Error("Not authorized. Admin or employee access required.");
    }

    // For employees, validate what they can update
    if (isEmployee) {
      switch (employeeRole) {
        case "call_center":
          // Call center can only update pending/address_confirmed orders
          if (
            order.status !== "pending" &&
            order.status !== "address_confirmed"
          ) {
            res.status(403);
            throw new Error(
              "Call center can only update pending or address confirmed orders",
            );
          }
          // Call center cannot change payment status
          if (
            paymentStatus !== undefined &&
            paymentStatus !== order.paymentStatus
          ) {
            res.status(403);
            throw new Error("Call center cannot modify payment status");
          }
          break;

        case "packer":
          // Packer can update processing/packed orders
          if (
            order.status !== "confirmed" &&
            (order.status as string) !== "processing" &&
            order.status !== "packed"
          ) {
            res.status(403);
            throw new Error(
              "Packer can only update confirmed, processing, or packed orders",
            );
          }
          break;

        case "deliveryman":
          // Deliveryman can update delivery-related orders
          if (
            order.status !== "packed" &&
            order.status !== "delivering" &&
            order.status !== "delivered"
          ) {
            res.status(403);
            throw new Error(
              "Deliveryman can only update delivery-related orders",
            );
          }
          break;

        case "accounts":
          // Accounts can update delivered/completed orders
          if (order.status !== "delivered" && order.status !== "completed") {
            res.status(403);
            throw new Error(
              "Accounts can only update delivered or completed orders",
            );
          }
          break;

        case "incharge":
          // Incharge has broader access
          break;

        default:
          res.status(403);
          throw new Error("Unknown employee role");
      }
    }

    // Validate status if provided
    if (status) {
      const validStatuses = [
        "pending",
        "address_confirmed",
        "confirmed",
        "packed",
        "delivering",
        "delivered",
        "completed",
        "cancelled",
      ];
      if (!validStatuses.includes(status)) {
        res.status(400);
        throw new Error(
          "Invalid status. Must be one of: pending, address_confirmed, confirmed, packed, delivering, delivered, completed, cancelled",
        );
      }
    }

    // Validate payment status if provided
    if (paymentStatus) {
      const validPaymentStatuses = ["pending", "paid", "failed", "refunded"];
      if (!validPaymentStatuses.includes(paymentStatus)) {
        res.status(400);
        throw new Error(
          "Invalid payment status. Must be one of: pending, paid, failed, refunded",
        );
      }
    }

    // Calculate total if items are provided
    let calculatedTotal = totalAmount;
    if (items && Array.isArray(items)) {
      calculatedTotal = items.reduce((total, item) => {
        return total + item.quantity * item.price;
      }, 0);
    }

    // Initialize status_updates if it doesn't exist
    if (!order.status_updates) {
      order.status_updates = {};
    }

    // Prepare update object
    const updateData: any = {
      updatedAt: new Date(),
    };

    // Update fields if provided
    if (status !== undefined) {
      updateData.status = status;

      // Add status tracking to status_updates object
      if (req.user) {
        const userName = req.user.name || req.user.email;
        const statusUpdateField = `status_updates.${status}`;

        switch (status) {
          case "address_confirmed":
            updateData[`status_updates.address_confirmed.by.id`] = req.user._id;
            updateData[`status_updates.address_confirmed.by.name`] = userName;
            updateData[`status_updates.address_confirmed.at`] = new Date();
            break;
          case "confirmed":
            updateData[`status_updates.order_confirmed.by.id`] = req.user._id;
            updateData[`status_updates.order_confirmed.by.name`] = userName;
            updateData[`status_updates.order_confirmed.at`] = new Date();

            // Reduce product stock and increase sold when order is confirmed by admin
            if (order.status !== "confirmed") {
              const Product = (await import("../models/productModel.js"))
                .default;
              for (const item of order.items) {
                await Product.findByIdAndUpdate(
                  item.productId,
                  {
                    $inc: {
                      stock: -item.quantity,
                      sold: item.quantity,
                    },
                  },
                  { new: true },
                );
              }
            }
            break;
          case "packed":
          case "delivering":
          case "delivered":
          case "completed":
            updateData[`${statusUpdateField}.by.id`] = req.user._id;
            updateData[`${statusUpdateField}.by.name`] = userName;
            updateData[`${statusUpdateField}.at`] = new Date();
            break;
          case "cancelled":
            updateData[`${statusUpdateField}.by.id`] = req.user._id;
            updateData[`${statusUpdateField}.by.name`] = userName;
            updateData[`${statusUpdateField}.at`] = new Date();

            // Revert product stock and decrease sold when order is cancelled by admin
            // Only revert if we are cancelling an order that was previously confirmed or beyond
            const statusHistoryAdmin = order.status_history || [];
            const wasConfirmedAdmin =
              order.status === "confirmed" ||
              order.status === "packed" ||
              order.status === "delivering" ||
              order.status === "delivered" ||
              statusHistoryAdmin.some((h: any) => h.status === "confirmed");

            if (wasConfirmedAdmin && order.status !== "cancelled") {
              const Product = (await import("../models/productModel.js"))
                .default;
              for (const item of order.items) {
                await Product.findByIdAndUpdate(
                  item.productId,
                  {
                    $inc: {
                      stock: item.quantity,
                      sold: -item.quantity,
                    },
                  },
                  { new: true },
                );
              }
            }
            break;
        }

        // Add to status history
        const statusHistoryEntry = {
          status,
          changed_at: new Date(),
          changed_by: {
            id: req.user._id,
            name: userName,
          },
          notes: "",
        };

        updateData.$push = { status_history: statusHistoryEntry };
      }
    }

    if (paymentStatus !== undefined) updateData.paymentStatus = paymentStatus;
    if (calculatedTotal !== undefined) updateData.total = calculatedTotal;
    if (items !== undefined) updateData.items = items;
    if (shippingAddress !== undefined)
      updateData.shippingAddress = shippingAddress;

    // Use findByIdAndUpdate with new populated data
    const updatedOrder = await Order.findByIdAndUpdate(
      req.params.id,
      updateData,
      {
        new: true,
        runValidators: false, // Disable validation to avoid shipping address issues
      },
    ).populate("userId", "name email");

    res.json({
      success: true,
      order: updatedOrder,
      message: "Order updated successfully",
    });
  },
);

// @desc    Delete order
// @route   DELETE /api/orders/:id
// @access  Private
export const deleteOrder: RequestHandler = asyncHandler(async (req, res) => {
  const order = await Order.findById(req.params.id);

  if (!order) {
    res.status(404);
    throw new Error("Order not found");
  }

  // Check if user owns this order or is an admin
  if (
    req.user.role !== "admin" &&
    order.userId.toString() !== req.user._id.toString()
  ) {
    res.status(403);
    throw new Error("Not authorized to delete this order");
  }

  await Order.findByIdAndDelete(req.params.id);

  res.json({
    success: true,
    message: "Order deleted successfully",
  });
});

// @desc    Get all orders for admin
// @route   GET /api/orders/admin
// @access  Private/Admin
export const getAllOrdersAdmin: RequestHandler = asyncHandler(
  async (req: RequestWithQuery<OrderQuery>, res) => {
    const page = parseInt(req.query.page || "1");
    const perPage = parseInt(req.query.perPage || "10");
    const sortOrder = req.query.sortOrder === "desc" ? -1 : 1;
    const status = req.query.status;
    const paymentStatus = req.query.paymentStatus;

    // Build filter object
    const filter: any = {};

    // Track if we need to filter by specific user actions
    let needsUserFilter = false;

    if (status && status !== "all") {
      // Special handling for call center pending orders
      if (
        status === "call_center_pending" &&
        req.user.role === "employee" &&
        req.user.employee_role === "call_center"
      ) {
        // Show both pending and address_confirmed orders
        filter.status = { $in: ["pending", "address_confirmed"] };
        needsUserFilter = true;
      }
      // For call center viewing their confirmed orders
      else if (
        status === "confirmed" &&
        req.user.role === "employee" &&
        req.user.employee_role === "call_center"
      ) {
        needsUserFilter = true;
        filter.status = status;
        filter["status_updates.order_confirmed.by.id"] = req.user._id;
      }
      // For packers viewing their packed orders
      else if (
        status === "packed" &&
        req.user.role === "employee" &&
        req.user.employee_role === "packer"
      ) {
        needsUserFilter = true;
        filter.status = status;
        filter["status_updates.packed.by.id"] = req.user._id;
      } else {
        filter.status = status;
      }
    }

    if (paymentStatus && paymentStatus !== "all") {
      // Map payment status to actual status values
      if (paymentStatus === "paid") {
        // If we already have a status filter (like "packed"), combine them
        if (filter.status && !needsUserFilter) {
          // Don't override if it's a single status
          // Only override if we haven't set a specific status
        } else if (!filter.status) {
          filter.status = { $in: ["paid", "completed"] };
        }
      } else if (paymentStatus === "pending") {
        if (!filter.status) {
          filter.status = "pending";
        }
      } else if (paymentStatus === "failed") {
        if (!filter.status) {
          filter.status = "cancelled";
        }
      }
    }

    const skip = (page - 1) * perPage;

    const orders = await Order.find(filter)
      .populate("userId", "name email")
      .populate("items.productId", "name price image")
      .populate("assignedDeliveryman", "name email")
      .sort({ createdAt: sortOrder } as any)
      .skip(skip)
      .limit(perPage);

    const total = await Order.countDocuments(filter);
    const totalPages = Math.ceil(total / perPage);

    // Transform data to match frontend expectations
    const transformedOrders = orders.map((order) => ({
      _id: order._id,
      orderId: `ORD-${order._id.toString().slice(-6).toUpperCase()}`,
      user: {
        _id: (order.userId as any)?._id || null,
        name: (order.userId as any)?.name || "Unknown User",
        email: (order.userId as any)?.email || "No Email",
      },
      items:
        order.items
          ?.filter((item) => item && item.productId) // Filter out items with missing products
          .map((item) => ({
            product: {
              _id: (item.productId as any)._id,
              name: (item.productId as any).name || "Unknown Product",
              price: (item.productId as any).price || 0,
              image: (item.productId as any).image || "/placeholder-image.jpg",
            },
            quantity: item.quantity || 1,
            price: item.price || 0,
          })) || [], // Fallback to empty array if items is undefined
      totalAmount: order.total,
      status: order.status,
      // Use proper type assertion or check
      paymentStatus: (order as any).paymentStatus || "pending",
      paymentMethod: (order as any).paymentMethod,
      shippingAddress: order.shippingAddress || {
        street: "N/A",
        city: "N/A",
        state: "N/A",
        zipCode: "N/A",
        country: "N/A",
      },
      assignedDeliveryman: order.assignedDeliveryman
        ? {
            _id: (order.assignedDeliveryman as any)._id,
            name: (order.assignedDeliveryman as any).name,
            email: (order.assignedDeliveryman as any).email,
          }
        : null,
      status_history: (order as any).status_history || [],
      status_updates: (order as any).status_updates || {},
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
    }));

    res.json({
      orders: transformedOrders,
      total,
      totalPages,
      currentPage: page,
    });
  },
);

// @desc    Search products for adding to orders
// @route   GET /api/orders/search-products
// @access  Private (Admin)
export const searchProductsForOrders: RequestHandler = asyncHandler(
  async (req: RequestWithQuery<SearchProductsQuery>, res) => {
    // Check if user is admin
    if (req.user.role !== "admin") {
      res.status(403);
      throw new Error("Not authorized. Admin access required.");
    }

    const { search, limit = "10" } = req.query;

    if (!search || search.trim() === "") {
      res.status(400);
      throw new Error("Search query is required");
    }

    // Import Product model (assuming it exists)
    const Product = (await import("../models/productModel.js")).default;

    const products = await Product.find({
      $or: [
        { name: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } },
      ],
      isActive: true, // Only active products
    })
      .select("_id name price image description category")
      .limit(parseInt(limit));

    res.json({
      success: true,
      products: products.map((product) => ({
        _id: product._id,
        name: product.name,
        price: product.price,
        image: product.image,
        category: product.category,
      })),
    });
  },
);

export default {
  getOrders,
  getOrderById,
  createCODOrder,
  createOrderFromCart,
  updateOrderStatus,
  updateOrderPaymentStatus,
  updateOrder,
  deleteOrder,
  getAllOrdersAdmin,
  searchProductsForOrders,
} as any;
