import type { Request, Response, NextFunction } from "express";
import type { Document, Types } from "mongoose";

// ============================================================================
// User Types
// ============================================================================
export type UserRole = "admin" | "user" | "employee" | "seller";
export type EmployeeRole =
  | "packer"
  | "deliveryman"
  | "accounts"
  | "incharge"
  | "call_center";
export type AuthProvider = "local" | "google" | "github";

export interface IAddress {
  _id?: Types.ObjectId;
  street: string;
  city: string;
  state: string;
  country: string;
  postalCode: string;
  isDefault: boolean;
}

export interface ICartItem {
  productId: Types.ObjectId;
  quantity: number;
}

export interface IUser extends Document {
  _id: Types.ObjectId;
  name: string;
  email: string;
  password?: string;
  dev_password?: string;
  avatar: string;
  role: UserRole;
  employee_role: EmployeeRole | null;
  isOAuthUser: boolean;
  authProvider: AuthProvider;
  authUid: string | null;
  hasSetPassword: boolean;
  resetPasswordToken?: string;
  resetPasswordExpire?: Date;
  addresses: IAddress[];
  wishlist: Types.ObjectId[];
  cart: ICartItem[];
  createdAt: Date;
  updatedAt: Date;
  matchPassword(enteredPassword: string): Promise<boolean>;
}

// ============================================================================
// Product Types
// ============================================================================
export interface IProductImage {
  url: string;
  alt?: string;
}

export interface IProductVariant {
  name: string;
  price: number;
  stock: number;
  sku?: string;
}

export interface IProduct extends Document {
  _id: Types.ObjectId;
  name: string;
  slug: string;
  description: string;
  price: number;
  comparePrice?: number;
  category: Types.ObjectId;
  brand?: Types.ObjectId;
  productType?: Types.ObjectId;
  images: IProductImage[];
  variants?: IProductVariant[];
  stock: number;
  sku?: string;
  featured: boolean;
  isActive: boolean;
  seller?: Types.ObjectId;
  tags?: string[];
  createdAt: Date;
  updatedAt: Date;
}

// ============================================================================
// Order Types
// ============================================================================
export type OrderStatus =
  | "pending"
  | "confirmed"
  | "processing"
  | "packed"
  | "shipped"
  | "out_for_delivery"
  | "delivered"
  | "cancelled"
  | "returned"
  | "refunded";

export type PaymentStatus = "pending" | "paid" | "failed" | "refunded";
export type PaymentMethod = "cod" | "stripe" | "sslcommerz";

export interface IOrderItem {
  product: Types.ObjectId;
  name: string;
  price: number;
  quantity: number;
  image?: string;
}

export interface IShippingAddress {
  street: string;
  city: string;
  state: string;
  country: string;
  postalCode: string;
  phone?: string;
}

export interface IOrder extends Document {
  _id: Types.ObjectId;
  user: Types.ObjectId;
  orderNumber: string;
  items: IOrderItem[];
  shippingAddress: IShippingAddress;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  status: OrderStatus;
  subtotal: number;
  shippingCost: number;
  tax: number;
  total: number;
  notes?: string;
  trackingNumber?: string;
  deliveredAt?: Date;
  paidAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

// ============================================================================
// Category Types
// ============================================================================
export interface ICategory extends Document {
  _id: Types.ObjectId;
  name: string;
  slug: string;
  description?: string;
  image?: string;
  parent?: Types.ObjectId;
  isActive: boolean;
  order: number;
  createdAt: Date;
  updatedAt: Date;
}

// ============================================================================
// Brand Types
// ============================================================================
export interface IBrand extends Document {
  _id: Types.ObjectId;
  name: string;
  slug: string;
  logo?: string;
  description?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// ============================================================================
// Banner Types
// ============================================================================
export interface IBanner extends Document {
  _id: Types.ObjectId;
  title: string;
  image: string;
  link?: string;
  isActive: boolean;
  order: number;
  createdAt: Date;
  updatedAt: Date;
}

// ============================================================================
// Request/Response Helpers
// ============================================================================
export interface AuthenticatedRequest extends Request {
  user: IUser;
}

export type AsyncHandler<T = void> = (
  req: Request,
  res: Response,
  next: NextFunction
) => Promise<T>;

export type AuthenticatedHandler<T = void> = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => Promise<T>;

// ============================================================================
// API Response Types
// ============================================================================
export interface ApiResponse<T = unknown> {
  success: boolean;
  message?: string;
  data?: T;
  error?: string;
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// ============================================================================
// JWT Payload
// ============================================================================
export interface JwtPayload {
  id: string;
  iat?: number;
  exp?: number;
}

// ============================================================================
// Environment Variables
// ============================================================================
export interface ProcessEnv {
  NODE_ENV: "development" | "production" | "test";
  PORT: string;
  MONGO_URI: string;
  JWT_SECRET: string;
  JWT_EXPIRE: string;
  JWT_REFRESH_EXPIRE: string;
  CLIENT_URL: string;
  ADMIN_URL: string;
  CLOUDINARY_CLOUD_NAME: string;
  CLOUDINARY_API_KEY: string;
  CLOUDINARY_API_SECRET: string;
  AWS_ACCESS_KEY_ID: string;
  AWS_SECRET_ACCESS_KEY: string;
  AWS_REGION: string;
  AWS_S3_BUCKET: string;
  STRIPE_SECRET_KEY: string;
  STRIPE_WEBHOOK_SECRET: string;
  SMTP_HOST: string;
  SMTP_PORT: string;
  SMTP_USER: string;
  SMTP_PASS: string;
  DEFAULT_USER_IMAGE: string;
}
