import { RequestHandler } from "express";
import asyncHandler from "express-async-handler";
import User from "../models/userModel.js";
import Cart from "../models/cartModel.js";
import Order from "../models/orderModel.js";
import uploadService from "../config/uploadService.js";
import { RequestWithQuery, RequestWithBody, PaginationQuery } from "../types/express.js";

// Interfaces
interface UserQuery extends PaginationQuery {
  role?: string;
  employee_role?: string;
  search?: string;
}

interface Address {
  street: string;
  city: string;
  state: string;
  country: string;
  postalCode: string;
  isDefault?: boolean;
}

interface CreateUserBody {
  name: string;
  email: string;
  password?: string;
  role?: string;
  employee_role?: string;
  addresses?: Address[];
}

interface UpdateUserBody {
  name?: string;
  role?: string;
  employee_role?: string;
  addresses?: Address[];
  emailVerified?: boolean;
  avatar?: string;
  password?: string;
  oldPassword?: string;
}

interface AddressBody {
  street: string;
  city: string;
  state: string;
  country: string;
  postalCode: string;
  isDefault?: boolean;
}

interface ChangePasswordBody {
  currentPassword?: string;
  newPassword?: string;
}

// @desc    Get all users
// @route   GET /api/users
// @access  Private/Admin
const getUsers: RequestHandler = asyncHandler(async (req: RequestWithQuery<UserQuery>, res) => {
  const {
    page = "1",
    perPage = "20",
    sortOrder = "desc",
    role,
    employee_role,
    search,
  } = req.query;

  // Convert to numbers
  const pageNum = parseInt(page);
  let limitNum = parseInt(perPage);

  // Handle "all" case - if perPage is very large, get all records
  const isGetAll = limitNum > 1000;
  const skip = isGetAll ? 0 : (pageNum - 1) * limitNum;

  // Build filter object
  let filter: any = {};

  // Filter by role if specified (case-insensitive)
  if (role && role !== "all") {
    filter.role = { $regex: new RegExp(`^${role}$`, "i") };
  }

  // Filter by employee_role if specified
  if (employee_role && employee_role !== "all") {
    filter.employee_role = employee_role;
  }

  // Add search functionality
  if (search) {
    filter.$or = [
      { name: { $regex: search, $options: "i" } },
      { email: { $regex: search, $options: "i" } },
    ];
  }

  try {
    // Get total count for pagination
    const total = await User.countDocuments(filter);

    // Calculate total pages
    const totalPages = isGetAll ? 1 : Math.ceil(total / limitNum);

    // Get users with pagination
    let query = User.find(filter)
      .select("-password")
      .sort({ createdAt: sortOrder === "asc" ? 1 : -1 });

    if (!isGetAll) {
      query = query.skip(skip).limit(limitNum);
    }

    const users = await query;

    res.json({
      users,
      total,
      totalPages,
      currentPage: isGetAll ? 1 : pageNum,
      perPage: isGetAll ? total : limitNum,
      hasNextPage: isGetAll ? false : pageNum < totalPages,
      hasPrevPage: isGetAll ? false : pageNum > 1,
    });
  } catch (error) {
    console.error("Error fetching users:", error);
    res.status(500);
    throw new Error("Failed to fetch users");
  }
});

// @desc    Get user by ID
// @route   GET /api/users/:id
// @access  Private
const getUserById: RequestHandler = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id).select("-password");

  if (user) {
    res.json(user);
  } else {
    res.status(404);
    throw new Error("User not found");
  }
});

// @desc    Get user password (dev mode only)
// @route   GET /api/users/:id/password
// @access  Private/Admin (Dev mode only)
const getUserPassword: RequestHandler = asyncHandler(async (req, res) => {
  // Only allow in development mode
  if (process.env.NODE_ENV !== "development") {
    res.status(403);
    throw new Error("Password viewing is only available in development mode");
  }

  const user = await User.findById(req.params.id).select("+dev_password");

  if (!user) {
    res.status(404);
    throw new Error("User not found");
  }

  // Decode the dev password if it exists
  let plainPassword = null;
  if (user.dev_password) {
    try {
      plainPassword = Buffer.from(user.dev_password, "base64").toString(
        "utf-8"
      );
    } catch (error) {
      console.error("Error decoding password:", error);
    }
  }

  res.json({
    userId: user._id,
    email: user.email,
    name: user.name,
    hashedPassword: user.password,
    plainPassword: plainPassword,
    available: !!plainPassword,
    message: plainPassword
      ? "Password retrieved successfully (Development Mode Only)"
      : "Password not available. This might be an old user created before dev mode was enabled.",
    warning:
      "⚠️ This endpoint only works in development mode. Never use in production!",
    tip: "To reset a user's password, use the update endpoint with a new password",
  });
});

// @desc    Create a user
// @route   POST /api/users
// @access  Private/Admin
const createUser: RequestHandler = asyncHandler(async (req: RequestWithBody<CreateUserBody>, res) => {
  const { name, email, password, role, employee_role, addresses } = req.body;

  const userExists = await User.findOne({ email });

  if (userExists) {
    res.status(400);
    throw new Error("User already exists");
  }

  const user = await User.create({
    name,
    email,
    password,
    role,
    employee_role: role === "employee" ? employee_role : null,
    addresses: addresses || [],
  });

  if (user) {
    // Initialize empty cart
    await Cart.create({ userId: user._id, items: [] });

    res.status(201).json({
      _id: user._id,
      name: user.name,
      email: user.email,
      avatar: user.avatar,
      role: user.role,
      employee_role: user.employee_role,
      addresses: user.addresses,
    });
  } else {
    res.status(400);
    throw new Error("Invalid user data");
  }
});

// @desc    Update user
// @route   PUT /api/users/:id
// @access  Private
const updateUser: RequestHandler = asyncHandler(async (req: RequestWithBody<UpdateUserBody>, res) => {
  const user = await User.findById(req.params.id);

  if (!user) {
    res.status(404);
    throw new Error("User not found");
  }

  // Allow updates by the user themselves or admins
  if (
    user._id.toString() !== req.user._id.toString() &&
    req.user.role !== "admin"
  ) {
    res.status(403);
    throw new Error("Not authorized to update this user");
  }

  // If password is being updated, verify old password (unless admin is bypassing in dev)
  if (req.body.password) {
    // Check if old password verification is required
    if (req.body.oldPassword) {
      // Verify the old password
      const isMatch = await user.matchPassword(req.body.oldPassword);
      if (!isMatch) {
        res.status(401);
        throw new Error("Current password is incorrect");
      }
    }
    // If no oldPassword provided
    else {
      // If updating self, old password is MANDATORY (even for admins)
      if (user._id.toString() === req.user._id.toString()) {
        res.status(400);
        throw new Error("Current password is required to verify your identity");
      }

      // If updating others, only admin can bypass old password
      if (req.user.role !== "admin") {
        res.status(403);
        throw new Error("Current password is required to update password");
      }
    }

    user.password = req.body.password;
  }

  user.name = req.body.name || user.name;
  if (req.body.role) {
    user.role = req.body.role as "user" | "admin" | "seller" | "employee";
    if (req.body.role === "employee") {
      user.employee_role = req.body.employee_role as "packer" | "deliveryman" | null;
    } else {
      // If role is not employee, clear employee_role
      user.employee_role = null;
    }
  }
  // Update employee_role if provided (for employees)
  if (req.body.role === "employee" && req.body.employee_role) {
    user.employee_role = req.body.employee_role as "packer" | "deliveryman" | null;
  }
  if (req.body.addresses) {
    user.addresses = req.body.addresses.map((addr: any) => ({
      ...addr,
      isDefault: addr.isDefault || false
    }));
  }

  // Allow updating emailVerified status (Admin only or system)
  if (req.body.emailVerified !== undefined) {
    user.emailVerified = req.body.emailVerified;
  }

  if (req.body.avatar && req.body.avatar !== user.avatar) {
    // Replace avatar using upload service
    const result = await uploadService.replaceImage(
      req.body.avatar,
      user.avatar,
      {
        folder: "users",
        originalName: `avatar_${user.email
          .replace("@", "_")
          .replace(".", "_")}.jpg`,
      }
    );
    user.avatar = result.url;
  }

  const updatedUser = await user.save();

  res.json({
    _id: updatedUser._id,
    name: updatedUser.name,
    email: updatedUser.email,
    avatar: updatedUser.avatar,
    role: updatedUser.role,
    employee_role: updatedUser.employee_role,
    addresses: updatedUser.addresses,
  });
});

// @desc    Delete user
// @route   DELETE /api/users/:id
// @access  Private/Admin
const deleteUser: RequestHandler = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);

  if (user) {
    // Delete associated avatar image before deleting the user
    if (user.avatar) {
      try {
        await uploadService.deleteImage(user.avatar);
      } catch (error: any) {
        console.error(`Failed to delete user avatar: ${error.message}`);
        // Continue with user deletion even if avatar deletion fails
      }
    }

    // Delete user's cart
    await Cart.deleteOne({ userId: user._id });

    // Delete user's orders (if any exist)
    await Order.deleteMany({ userId: user._id });

    // Delete the user
    await user.deleteOne();
    res.json({
      message: "User and associated data removed successfully",
      deletedAvatar: user.avatar || null,
    });
  } else {
    res.status(404);
    throw new Error("User not found");
  }
});

// @desc    Add address to user
// @route   POST /api/users/:id/addresses
// @access  Private
const addAddress: RequestHandler = asyncHandler(async (req: RequestWithBody<AddressBody>, res) => {

  const user = await User.findById(req.params.id);

  if (!user) {
    res.status(404);
    throw new Error("User not found");
  }

  // Only allow user to modify their own addresses or admin
  if (
    user._id.toString() !== req.user._id.toString() &&
    req.user.role !== "admin"
  ) {
    res.status(403);
    throw new Error("Not authorized to modify this user's addresses");
  }

  const { street, city, state, country, postalCode, isDefault } = req.body;



  if (!street || !city || !state || !country || !postalCode) {
    res.status(400);
    throw new Error(
      "All address fields are required (street, city, state, country, postalCode)"
    );
  }

  // If this is set as default, make other addresses non-default
  if (isDefault) {
    user.addresses.forEach((addr) => {
      addr.isDefault = false;
    });
  }

  // If this is the first address, make it default
  if (user.addresses.length === 0) {
    user.addresses.push({
      street,
      city,
      state,
      country,
      postalCode,
      isDefault: true,
    });
  } else {
    user.addresses.push({
      street,
      city,
      state,
      country,
      postalCode,
      isDefault: isDefault || false,
    });
  }

  await user.save();

  res.json({
    success: true,
    addresses: user.addresses,
    message: "Address added successfully",
  });
});


// @desc    Update address
// @route   PUT /api/users/:id/addresses/:addressId
// @access  Private
const updateAddress: RequestHandler = asyncHandler(async (req: RequestWithBody<AddressBody>, res) => {

  const user = await User.findById(req.params.id);

  if (!user) {
    res.status(404);
    throw new Error("User not found");
  }

  // Only allow user to modify their own addresses or admin
  if (
    user._id.toString() !== req.user._id.toString() &&
    req.user.role !== "admin"
  ) {
    res.status(403);
    throw new Error("Not authorized to modify this user's addresses");
  }

  const address = (user.addresses as any).id(req.params.addressId);

  if (!address) {
    res.status(404);
    throw new Error("Address not found");
  }

  const { street, city, state, country, postalCode, isDefault } = req.body;



  if (street) address.street = street;
  if (city) address.city = city;
  if (state) address.state = state;
  if (country) address.country = country;
  if (postalCode) address.postalCode = postalCode;

  // If this is set as default, make other addresses non-default
  if (isDefault) {
    user.addresses.forEach((addr) => {
      addr.isDefault = false;
    });
    address.isDefault = true;
  }

  await user.save();

  res.json({
    success: true,
    addresses: user.addresses,
    message: "Address updated successfully",
  });
});

// @desc    Delete address
// @route   DELETE /api/users/:id/addresses/:addressId
// @access  Private
const deleteAddress: RequestHandler = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);

  if (!user) {
    res.status(404);
    throw new Error("User not found");
  }

  // Only allow user to modify their own addresses or admin
  if (
    user._id.toString() !== req.user._id.toString() &&
    req.user.role !== "admin"
  ) {
    res.status(403);
    throw new Error("Not authorized to modify this user's addresses");
  }

  const address = (user.addresses as any).id(req.params.addressId);

  if (!address) {
    res.status(404);
    throw new Error("Address not found");
  }

  // If deleting default address, make the first remaining address default
  const wasDefault = address.isDefault;
  (user.addresses as any).pull(req.params.addressId);

  if (wasDefault && user.addresses.length > 0) {
    user.addresses[0].isDefault = true;
  }

  await user.save();

  res.json({
    success: true,
    addresses: user.addresses,
    message: "Address deleted successfully",
  });
});

// @desc    Change user password
// @route   PUT /api/users/:id/password
// @access  Private
const changePassword: RequestHandler = asyncHandler(async (req: RequestWithBody<ChangePasswordBody>, res) => {
  const { currentPassword, newPassword } = req.body;

  if (!currentPassword || !newPassword) {
    res.status(400);
    throw new Error("Current password and new password are required");
  }

  if (newPassword.length < 8) {
    res.status(400);
    throw new Error("New password must be at least 8 characters long");
  }

  const user = await User.findById(req.params.id);

  if (!user) {
    res.status(404);
    throw new Error("User not found");
  }

  // Only allow user to change their own password
  if (user._id.toString() !== req.user._id.toString()) {
    res.status(403);
    throw new Error("Not authorized to change this user's password");
  }

  // Check if user is OAuth user without password
  if (user.isOAuthUser && !user.hasSetPassword) {
    res.status(400);
    throw new Error(
      "OAuth users must set a password first using the set password feature"
    );
  }

  // Verify current password
  const isMatch = await user.matchPassword(currentPassword);

  if (!isMatch) {
    res.status(401);
    throw new Error("Current password is incorrect");
  }

  // Update to new password
  user.password = newPassword;
  await user.save();

  res.json({
    success: true,
    message: "Password changed successfully",
  });
});

export {
  getUsers,
  getUserPassword,
  getUserById,
  createUser,
  updateUser,
  deleteUser,
  addAddress,
  updateAddress,
  deleteAddress,
  changePassword,
};
