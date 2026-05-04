import mongoose, { Schema, type Document, type Model, type Types } from "mongoose";
import bcrypt from "bcryptjs";

// Types
export type UserRole = "admin" | "user" | "employee" | "seller";

export type EmployeeRole =
  | "packer"
  | "deliveryman"
  | "accounts"
  | "incharge"
  | "call_center";

export type AuthProvider = "local" | "google" | "github";

// Address
export interface IAddress {
  _id?: Types.ObjectId;
  street: string;
  city: string;
  state: string;
  country: string;
  postalCode: string;
  isDefault: boolean;
}

// Cart
export interface ICartItem {
  productId: Types.ObjectId;
  quantity: number;
}

// ✅ MAIN USER INTERFACE (IMPORTANT FIX)
export interface IUser extends Document {
  _id: Types.ObjectId;

  name: string;
  email: string;
  password?: string;
  dev_password?: string;

  avatar: string;

  role: UserRole; // ✅ strict type
  employee_role: EmployeeRole | null;

  isOAuthUser: boolean;
  authProvider: AuthProvider;
  authUid: string | null;

  hasSetPassword: boolean;

  resetPasswordToken?: string | null;
  resetPasswordExpire?: Date | null;

  emailVerified: boolean;

  verificationToken?: string | null;
  verificationTokenExpire?: Date | null;

  addresses: IAddress[];
  wishlist: Types.ObjectId[];
  cart: ICartItem[];

  createdAt: Date;
  updatedAt: Date;

  matchPassword(enteredPassword: string): Promise<boolean>;
}

// ✅ Schema
const userSchema = new Schema<IUser>(
  {
    name: { type: String, required: true },

    email: { type: String, required: true, unique: true },

    password: {
      type: String,
      required: function (this: IUser) {
        return !this.isOAuthUser;
      },
    },

    dev_password: {
      type: String,
      select: false,
      default: null,
    },

    avatar: {
      type: String,
      default:
        process.env.DEFAULT_USER_IMAGE ||
        "https://res.cloudinary.com/dxkhdqifr/image/upload/v1767712291/user_hz2mcv.png",
    },

    // ✅ FIX: ENUM ADD করা হয়েছে (important)
    role: {
      type: String,
      enum: ["admin", "user", "employee", "seller"],
      default: "user",
    },

    employee_role: {
      type: String,
      enum: ["packer", "deliveryman", "accounts", "incharge", "call_center"],
      default: null,
      validate: {
        validator: function (this: IUser, value: EmployeeRole | null) {
          if (this.role === "employee" && !value) return false;
          if (this.role !== "employee" && value) return false;
          return true;
        },
        message:
          "Employee role is required for employees and should be null for non-employees",
      },
    },

    isOAuthUser: { type: Boolean, default: false },

    authProvider: {
      type: String,
      enum: ["local", "google", "github"],
      default: "local",
    },

    authUid: { type: String, default: null },

    hasSetPassword: {
      type: Boolean,
      default: function (this: IUser) {
        return !this.isOAuthUser;
      },
    },

    resetPasswordToken: { type: String, default: null },
    resetPasswordExpire: { type: Date, default: null },

    emailVerified: {
      type: Boolean,
      default: function (this: IUser) {
        return this.isOAuthUser;
      },
    },

    verificationToken: { type: String, default: null },
    verificationTokenExpire: { type: Date, default: null },

    addresses: [
      {
        street: { type: String, required: true },
        city: { type: String, required: true },
        state: { type: String, required: true },
        country: { type: String, required: true },
        postalCode: { type: String, required: true },
        isDefault: { type: Boolean, default: false },
      },
    ],

    wishlist: [{ type: Schema.Types.ObjectId, ref: "Product" }],

    cart: [
      {
        productId: {
          type: Schema.Types.ObjectId,
          ref: "Product",
          required: true,
        },
        quantity: {
          type: Number,
          required: true,
          min: 1,
        },
      },
    ],
  },
  { timestamps: true }
);

// ✅ password compare
userSchema.methods.matchPassword = async function (
  enteredPassword: string
) {
  if (!this.password) return false;
  return await bcrypt.compare(enteredPassword, this.password);
};

// ✅ pre-save
userSchema.pre("save", async function (this: IUser, next) {
  try {
    if (this.isModified("password") && this.password) {
      if (process.env.NODE_ENV === "development") {
        this.dev_password = Buffer.from(this.password).toString("base64");
      }

      const salt = await bcrypt.genSalt(10);
      this.password = await bcrypt.hash(this.password, salt);

      if (this.isOAuthUser) {
        this.hasSetPassword = true;
      }
    }

    if (this.isModified("addresses") && this.addresses?.length > 0) {
      const defaultAddress = this.addresses.find((a) => a.isDefault);
      if (defaultAddress) {
        this.addresses.forEach((a) => {
          if (a !== defaultAddress) a.isDefault = false;
        });
      }
    }

    next(); // ✅ IMPORTANT (missing before)
  } catch (err) {
    next(err as Error);
  }
});

const User: Model<IUser> = mongoose.model<IUser>("User", userSchema);

export default User;