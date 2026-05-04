// @ts-nocheck
import { Request, Response, NextFunction } from "express"; type RequestHandler = any;
import asyncHandler from "express-async-handler";
import User from "../models/userModel.js";
import bcrypt from "bcryptjs";

// @desc    Get all employees
// @route   GET /api/users/employees
// @access  Private/Admin or Incharge
const getEmployees: RequestHandler = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20, employee_role } = req.query as any;
  const skip = (page - 1) * limit;

  let filter: any = { role: "employee" };
  if (employee_role) {
    filter.employee_role = employee_role;
  }

  const employees = await User.find(filter)
    .select("-password")
    .sort({ createdAt: -1 })
    .skip(parseInt(skip))
    .limit(parseInt(limit));

  const total = await User.countDocuments(filter);

  res.json({
    success: true,
    data: {
      employees,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / limit),
        hasNextPage: page < Math.ceil(total / limit),
        hasPrevPage: page > 1,
      },
    },
  });
});

// @desc    Create new employee
// @route   POST /api/users/employees
// @access  Private/Admin or Incharge
const createEmployee: RequestHandler = asyncHandler(async (req, res) => {
  const { name, email, password, employee_role } = req.body as any;

  if (!name || !email || !password || !employee_role) {
    res.status(400);
    throw new Error("Please provide all required fields");
  }

  // Validate employee_role
  const validEmployeeRoles = ["packer", "deliveryman", "accounts", "incharge"];
  if (!validEmployeeRoles.includes(employee_role)) {
    res.status(400);
    throw new Error("Invalid employee role");
  }

  // Only admin can create incharge roles
  if (employee_role === "incharge" && req.user.role !== "admin") {
    res.status(403);
    throw new Error("Only administrators can create incharge roles");
  }

  // Check if user already exists
  const userExists = await User.findOne({ email });
  if (userExists) {
    res.status(400);
    throw new Error("User already exists");
  }

  // Create user
  const user = await User.create({
    name,
    email,
    password,
    role: "employee",
    employee_role,
  });

  if (user) {
    res.status(201).json({
      success: true,
      message: "Employee created successfully",
      data: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        employee_role: user.employee_role,
      },
    });
  } else {
    res.status(400);
    throw new Error("Invalid user data");
  }
});

// @desc    Update employee role
// @route   PUT /api/users/employees/:id/role
// @access  Private/Admin or Incharge
const updateEmployeeRole: RequestHandler = asyncHandler(async (req, res) => {
  const { employee_role } = req.body as any;

  if (!employee_role) {
    res.status(400);
    throw new Error("Employee role is required");
  }

  // Validate employee_role
  const validEmployeeRoles = ["packer", "deliveryman", "accounts", "incharge"];
  if (!validEmployeeRoles.includes(employee_role)) {
    res.status(400);
    throw new Error("Invalid employee role");
  }

  const user = await User.findById(req.params.id);
  if (!user) {
    res.status(404);
    throw new Error("User not found");
  }

  if (user.role !== "employee") {
    res.status(400);
    throw new Error("User is not an employee");
  }

  // Only admin can assign/modify incharge roles
  if (employee_role === "incharge" && req.user.role !== "admin") {
    res.status(403);
    throw new Error("Only administrators can assign incharge roles");
  }

  // Only admin can modify incharge users
  if (user.employee_role === "incharge" && req.user.role !== "admin") {
    res.status(403);
    throw new Error("Only administrators can modify incharge users");
  }

  user.employee_role = employee_role;
  await user.save();

  res.json({
    success: true,
    message: "Employee role updated successfully",
    data: {
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      employee_role: user.employee_role,
    },
  });
});

// @desc    Update user main role (admin only)
// @route   PUT /api/users/:id/main-role
// @access  Private/Admin only
const updateUserMainRole: RequestHandler = asyncHandler(async (req, res) => {
  const { role, employee_role } = req.body as any;

  if (!role) {
    res.status(400);
    throw new Error("Role is required");
  }

  // Validate main role
  const validRoles = ["admin", "user", "employee"];
  if (!validRoles.includes(role)) {
    res.status(400);
    throw new Error("Invalid role");
  }

  const user = await User.findById(req.params.id);
  if (!user) {
    res.status(404);
    throw new Error("User not found");
  }

  // Prevent admin from demoting themselves
  if (user._id.toString() === req.user._id.toString() && role !== "admin") {
    res.status(400);
    throw new Error("Cannot change your own admin role");
  }

  user.role = role;

  // Handle employee_role based on main role
  if (role === "employee") {
    if (!employee_role) {
      res.status(400);
      throw new Error("Employee role is required when role is employee");
    }

    const validEmployeeRoles = [
      "packer",
      "deliveryman",
      "accounts",
      "incharge",
    ];
    if (!validEmployeeRoles.includes(employee_role)) {
      res.status(400);
      throw new Error("Invalid employee role");
    }

    user.employee_role = employee_role;
  } else {
    // Clear employee_role for non-employee roles
    user.employee_role = null;
  }

  await user.save();

  res.json({
    success: true,
    message: "User role updated successfully",
    data: {
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      employee_role: user.employee_role,
    },
  });
});

// @desc    Get all users with roles
// @route   GET /api/users/with-roles
// @access  Private/Admin
const getAllUsersWithRoles: RequestHandler = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20, role } = req.query as any;
  const skip = (page - 1) * limit;

  let filter: any = {};
  if (role) {
    filter.role = role;
  }

  const users = await User.find(filter)
    .select("-password")
    .sort({ createdAt: -1 })
    .skip(parseInt(skip))
    .limit(parseInt(limit));

  const total = await User.countDocuments(filter);

  // Get role statistics
  const roleStats = await User.aggregate([
    {
      $group: {
        _id: "$role",
        count: { $sum: 1 },
      },
    },
  ]);

  const employeeRoleStats = await User.aggregate([
    {
      $match: { role: "employee" },
    },
    {
      $group: {
        _id: "$employee_role",
        count: { $sum: 1 },
      },
    },
  ]);

  res.json({
    success: true,
    data: {
      users,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / limit),
        hasNextPage: page < Math.ceil(total / limit),
        hasPrevPage: page > 1,
      },
      statistics: {
        roleStats,
        employeeRoleStats,
      },
    },
  });
});

// @desc    Get employees by role for assignment
// @route   GET /api/users/employees/by-role/:employee_role
// @access  Private/Incharge
const getEmployeesByRole: RequestHandler = asyncHandler(async (req, res) => {
  const { employee_role } = req.params;

  const validEmployeeRoles = ["packer", "deliveryman", "accounts", "incharge"];
  if (!validEmployeeRoles.includes(employee_role)) {
    res.status(400);
    throw new Error("Invalid employee role");
  }

  const employees = await User.find({
    role: "employee",
    employee_role: employee_role,
  }).select("_id name email");

  res.json({
    success: true,
    data: employees,
  });
});

// @desc    Deactivate employee
// @route   PUT /api/users/employees/:id/deactivate
// @access  Private/Admin only
const deactivateEmployee: RequestHandler = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) {
    res.status(404);
    throw new Error("User not found");
  }

  if (user.role !== "employee") {
    res.status(400);
    throw new Error("User is not an employee");
  }

  // For now, we'll change role to 'user' to deactivate
  // In future, you might want to add an 'isActive' field
  user.role = "user";
  user.employee_role = null;
  await user.save();

  res.json({
    success: true,
    message: "Employee deactivated successfully",
    data: {
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      employee_role: user.employee_role,
    },
  });
});

export {
  getEmployees,
  createEmployee,
  updateEmployeeRole,
  updateUserMainRole,
  getAllUsersWithRoles,
  getEmployeesByRole,
  deactivateEmployee,
};
