import Notification from "../models/notificationModel.js";
import User from "../models/userModel.js";
import type { Types, UpdateWriteOpResult } from "mongoose";

// Interfaces
interface NotificationParams {
  userId: Types.ObjectId | string;
  type: string;
  title: string;
  message: string;
  relatedOrderId?: Types.ObjectId | string | null;
  image?: string | null;
  actionUrl?: string | null;
  actionText?: string | null;
  priority?: "low" | "normal" | "high";
  senderId?: Types.ObjectId | string | null;
  isBulkSent?: boolean;
  bulkSendId?: string | null;
  targetAudience?: "all" | "specific";
  metadata?: Record<string, unknown>;
}

interface BulkNotificationParams {
  type: string;
  title: string;
  message: string;
  image?: string | null;
  actionUrl?: string | null;
  actionText?: string | null;
  priority?: "low" | "normal" | "high";
  senderId: Types.ObjectId | string;
  userIds?: Types.ObjectId[] | string[] | null;
  targetAudience?: "all" | "specific";
}

interface BulkSendsParams {
  limit?: number;
  skip?: number;
}

interface GetNotificationsParams {
  limit?: number;
  skip?: number;
  unreadOnly?: boolean;
}

interface OrderInfo {
  _id: Types.ObjectId;
  total: number;
  status: string;
}

interface NotificationDocument {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  type: string;
  title: string;
  message: string;
  isRead: boolean;
  createdAt: Date;
  // Add other fields as needed
}

interface BulkSendResult {
  success: boolean;
  count: number;
  bulkSendId: string;
  notifications: NotificationDocument[];
}

interface BulkSendAggregation {
  _id: string;
  type: string;
  title: string;
  message: string;
  image: string | null;
  priority: string;
  targetAudience: string;
  senderId: Types.ObjectId | null;
  createdAt: Date;
  totalSent: number;
  readCount: number;
}

interface GetBulkSendsResult {
  bulkSends: BulkSendAggregation[];
  total: number;
}

interface GetNotificationsResult {
  notifications: NotificationDocument[];
  total: number;
  unreadCount: number;
}

class NotificationService {
  // Create a new notification
  async createNotification({
    userId,
    type,
    title,
    message,
    relatedOrderId = null,
    image = null,
    actionUrl = null,
    actionText = null,
    priority = "normal",
    senderId = null,
    isBulkSent = false,
    bulkSendId = null,
    targetAudience = "specific",
    metadata = {},
  }: NotificationParams): Promise<NotificationDocument> {
    try {
      const notification = await Notification.create({
        userId,
        type,
        title,
        message,
        relatedOrderId,
        image,
        actionUrl,
        actionText,
        priority,
        senderId,
        isBulkSent,
        bulkSendId,
        targetAudience,
        metadata,
      });

      return notification;
    } catch (error) {
      console.error("❌ Failed to create notification:", error);
      throw error;
    }
  }

  // Send bulk notifications to all users
  async sendBulkNotification({
    type,
    title,
    message,
    image = null,
    actionUrl = null,
    actionText = null,
    priority = "normal",
    senderId,
    userIds = null,
    targetAudience = "all",
  }: BulkNotificationParams): Promise<BulkSendResult> {
    try {
      const bulkSendId = `bulk_${Date.now()}_${Math.random().toString(36).substring(7)}`;

      let targetUsers;
      let finalTargetAudience = targetAudience;

      if (userIds && userIds.length > 0) {
        targetUsers = await User.find({ _id: { $in: userIds } }).select("_id");
        finalTargetAudience = "specific";
      } else {
        targetUsers = await User.find({
          role: { $nin: ["admin", "employee"] },
        }).select("_id");
      }

      const notifications = await Promise.all(
        targetUsers.map((user) =>
          this.createNotification({
            userId: user._id,
            type,
            title,
            message,
            image,
            actionUrl,
            actionText,
            priority,
            senderId,
            isBulkSent: true,
            bulkSendId,
            targetAudience: finalTargetAudience,
          })
        )
      );

      return {
        success: true,
        count: notifications.length,
        bulkSendId,
        notifications: notifications.slice(0, 10),
      };
    } catch (error) {
      console.error("❌ Failed to send bulk notification:", error);
      throw error;
    }
  }

  // Get all bulk sends (for admin dashboard)
  async getBulkSends({
    limit = 20,
    skip = 0,
  }: BulkSendsParams): Promise<GetBulkSendsResult> {
    try {
      const bulkSends = (await Notification.aggregate([
        {
          $match: {
            isBulkSent: true,
          },
        },
        {
          $group: {
            _id: "$bulkSendId",
            type: { $first: "$type" },
            title: { $first: "$title" },
            message: { $first: "$message" },
            image: { $first: "$image" },
            priority: { $first: "$priority" },
            targetAudience: { $first: "$targetAudience" },
            senderId: { $first: "$senderId" },
            createdAt: { $first: "$createdAt" },
            totalSent: { $sum: 1 },
            readCount: {
              $sum: {
                $cond: ["$isRead", 1, 0],
              },
            },
          },
        },
        {
          $sort: { createdAt: -1 },
        },
        {
          $skip: skip,
        },
        {
          $limit: limit,
        },
      ])) as BulkSendAggregation[];

      const total = await Notification.distinct("bulkSendId", {
        isBulkSent: true,
      });

      return {
        bulkSends,
        total: total.length,
      };
    } catch (error) {
      console.error("❌ Failed to get bulk sends:", error);
      throw error;
    }
  }

  // Create order placed notification
  async notifyOrderPlaced(
    userId: Types.ObjectId | string,
    order: OrderInfo
  ): Promise<NotificationDocument> {
    return this.createNotification({
      userId,
      type: "order_placed",
      title: "Order Placed Successfully",
      message: `Your order #${order._id.toString().slice(-6).toUpperCase()} for $${order.total.toFixed(2)} has been placed successfully.`,
      relatedOrderId: order._id,
      metadata: {
        orderId: order._id,
        total: order.total,
        status: order.status,
      },
    });
  }

  // Create order confirmed notification
  async notifyOrderConfirmed(
    userId: Types.ObjectId | string,
    order: OrderInfo
  ): Promise<NotificationDocument> {
    return this.createNotification({
      userId,
      type: "order_confirmed",
      title: "Order Confirmed",
      message: `Your order #${order._id.toString().slice(-6).toUpperCase()} has been confirmed.`,
      relatedOrderId: order._id,
      metadata: {
        orderId: order._id,
        status: order.status,
      },
    });
  }

  // Create order shipped notification
  async notifyOrderShipped(
    userId: Types.ObjectId | string,
    order: OrderInfo
  ): Promise<NotificationDocument> {
    return this.createNotification({
      userId,
      type: "order_shipped",
      title: "Order Shipped",
      message: `Your order #${order._id.toString().slice(-6).toUpperCase()} has been shipped!`,
      relatedOrderId: order._id,
      metadata: {
        orderId: order._id,
        status: order.status,
      },
    });
  }

  // Create order delivered notification
  async notifyOrderDelivered(
    userId: Types.ObjectId | string,
    order: OrderInfo
  ): Promise<NotificationDocument> {
    return this.createNotification({
      userId,
      type: "order_delivered",
      title: "Order Delivered",
      message: `Your order #${order._id.toString().slice(-6).toUpperCase()} has been delivered!`,
      relatedOrderId: order._id,
      metadata: {
        orderId: order._id,
        status: order.status,
      },
    });
  }

  // Create payment success notification
  async notifyPaymentSuccess(
    userId: Types.ObjectId | string,
    order: OrderInfo
  ): Promise<NotificationDocument> {
    return this.createNotification({
      userId,
      type: "payment_success",
      title: "Payment Successful",
      message: `Your payment of $${order.total.toFixed(2)} for order #${order._id.toString().slice(-6).toUpperCase()} was successful.`,
      relatedOrderId: order._id,
      metadata: {
        orderId: order._id,
        amount: order.total,
      },
    });
  }

  // Get user notifications
  async getUserNotifications(
    userId: Types.ObjectId | string,
    { limit = 20, skip = 0, unreadOnly = false }: GetNotificationsParams
  ): Promise<GetNotificationsResult> {
    const query: Record<string, unknown> = { userId };
    if (unreadOnly) {
      query.isRead = false;
    }

    const notifications = await Notification.find(query)
      .sort({ createdAt: -1 })
      .limit(limit)
      .skip(skip);

    const total = await Notification.countDocuments(query);
    const unreadCount = await Notification.countDocuments({
      userId,
      isRead: false,
    });

    return {
      notifications,
      total,
      unreadCount,
    };
  }

  // Mark notification as read
  async markAsRead(
    notificationId: Types.ObjectId | string,
    userId: Types.ObjectId | string
  ): Promise<NotificationDocument | null> {
    const notification = await Notification.findOneAndUpdate(
      { _id: notificationId, userId },
      { isRead: true },
      { new: true }
    );

    return notification;
  }

  // Mark all notifications as read
  async markAllAsRead(
    userId: Types.ObjectId | string
  ): Promise<UpdateWriteOpResult> {
    const result = await Notification.updateMany(
      { userId, isRead: false },
      { isRead: true }
    );

    return result;
  }

  // Delete notification
  async deleteNotification(
    notificationId: Types.ObjectId | string,
    userId: Types.ObjectId | string
  ): Promise<{ deletedCount?: number }> {
    const result = await Notification.deleteOne({
      _id: notificationId,
      userId,
    });
    return result;
  }

  // Delete all notifications for a user
  async deleteAllNotifications(
    userId: Types.ObjectId | string
  ): Promise<{ deletedCount?: number }> {
    const result = await Notification.deleteMany({ userId });
    return result;
  }
}

export const notificationService = new NotificationService();
