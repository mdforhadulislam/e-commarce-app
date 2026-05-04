import mongoose, { Schema, Document } from "mongoose";

export interface IUserRole extends Document {
  name: string;
  value: string;
  description: string;
  permissions: string[];
  isSystem: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const userRoleSchema = new Schema<IUserRole>(
  {
    name: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    value: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    description: {
      type: String,
      required: false,
      default: "",
    },
    permissions: {
      type: [String],
      default: [],
    },
    isSystem: {
      type: Boolean,
      default: false,
      description: "System roles cannot be deleted",
    },
  },
  {
    timestamps: true,
  }
);

const UserRole = mongoose.model<IUserRole>("UserRole", userRoleSchema);

export default UserRole;
