import { Request, Response, RequestHandler } from "express";
import asyncHandler from "express-async-handler";
import UserRole from "../models/userRoleModel.js";
import Permission from "../models/permissionModel.js";

// @desc    Get all user roles
// @route   GET /api/roles
// @access  Private/Admin
const getRoles: RequestHandler = asyncHandler(async (req: Request, res: Response) => {
  const roles = await UserRole.find({}).sort({ createdAt: -1 });
  res.json(roles);
});

// @desc    Create a new user role
// @route   POST /api/roles
// @access  Private/Admin
const createRole: RequestHandler = asyncHandler(async (req: Request, res: Response) => {
  const { name, value, description, permissions } = req.body;

  const roleExists = await UserRole.findOne({ $or: [{ name }, { value }] });

  if (roleExists) {
    res.status(400);
    throw new Error("Role already exists");
  }

  const role = await UserRole.create({
    name,
    value,
    description,
    permissions: permissions || [],
  });

  if (role) {
    res.status(201).json(role);
  } else {
    res.status(400);
    throw new Error("Invalid role data");
  }
});

// @desc    Update a user role
// @route   PUT /api/roles/:id
// @access  Private/Admin
const updateRole: RequestHandler = asyncHandler(async (req: Request, res: Response) => {
  const role = await UserRole.findById(req.params.id);

  if (role) {
    role.name = req.body.name || role.name;
    role.value = req.body.value || role.value;
    role.description = req.body.description !== undefined ? req.body.description : role.description;
    role.permissions = req.body.permissions || role.permissions;

    const updatedRole = await role.save();
    res.json(updatedRole);
  } else {
    res.status(404);
    throw new Error("Role not found");
  }
});

// @desc    Delete a user role
// @route   DELETE /api/roles/:id
// @access  Private/Admin
const deleteRole: RequestHandler = asyncHandler(async (req: Request, res: Response) => {
  const role = await UserRole.findById(req.params.id);

  if (role) {
    if (role.isSystem) {
      res.status(400);
      throw new Error("System roles cannot be deleted");
    }

    await role.deleteOne();
    res.json({ message: "Role removed" });
  } else {
    res.status(404);
    throw new Error("Role not found");
  }
});

// @desc    Get system permissions (helper for frontend)
// @route   GET /api/roles/permissions
// @access  Private/Admin
const getAvailablePermissions: RequestHandler = asyncHandler(async (req: Request, res: Response) => {
    // Fetch dynamic permissions from the database
    const permissions = await Permission.find({}).select("value -_id");
    // Return just the values as an array of strings [ "admin_access", "manage_users" ]
    const permissionValues = permissions.map(p => p.value);
    res.json(permissionValues);
});

export {
  getRoles,
  createRole,
  updateRole,
  deleteRole,
  getAvailablePermissions
};
