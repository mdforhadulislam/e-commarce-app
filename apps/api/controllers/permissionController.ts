
import { Request, Response, RequestHandler } from "express";
import asyncHandler from "express-async-handler";
import Permission from "../models/permissionModel.js";

// @desc    Get all permissions
// @route   GET /api/permissions
// @access  Private/Admin
const getPermissions: RequestHandler = asyncHandler(async (req: Request, res: Response) => {
  const permissions = await Permission.find({}).sort({ title: 1 });
  res.json(permissions);
});

// @desc    Create a new permission
// @route   POST /api/permissions
// @access  Private/Admin
const createPermission: RequestHandler = asyncHandler(async (req: Request, res: Response) => {
  const { title, description } = req.body;

  if (!title) {
    res.status(400);
    throw new Error("Permission title is required");
  }

  // Use provided value or auto-generate from title (slugify)
  // e.g. "Admin Access" -> "admin_access"
  const permissionValue = req.body.value
    ? req.body.value.toLowerCase().trim()
    : title
        .toLowerCase()
        .trim()
        .replace(/[^\w\s-]/g, "") // remove non-word chars
        .replace(/[\s_-]+/g, "_")
        .replace(/^-+|-+$/g, "");

  const permissionExists = await Permission.findOne({ value: permissionValue });

  if (permissionExists) {
    res.status(400);
    throw new Error("Permission with this value already exists");
  }

  const permission = await Permission.create({
    title,
    value: permissionValue,
    description,
  });

  if (permission) {
    res.status(201).json(permission);
  } else {
    res.status(400);
    throw new Error("Invalid permission data");
  }
});

// @desc    Update a permission
// @route   PUT /api/permissions/:id
// @access  Private/Admin
const updatePermission: RequestHandler = asyncHandler(async (req: Request, res: Response) => {
  const permission = await Permission.findById(req.params.id);

  if (permission) {
    permission.title = req.body.title || permission.title;
    permission.description = req.body.description !== undefined ? req.body.description : permission.description;

    // Only allow updating value if it doesn't conflict
    if (req.body.value && req.body.value !== permission.value) {
      const permissionExists = await Permission.findOne({ value: req.body.value });
      if (permissionExists) {
        res.status(400);
        throw new Error("Permission with this value already exists");
      }
      permission.value = req.body.value;
    }

    const updatedPermission = await permission.save();
    res.json(updatedPermission);
  } else {
    res.status(404);
    throw new Error("Permission not found");
  }
});

// @desc    Delete a permission
// @route   DELETE /api/permissions/:id
// @access  Private/Admin
const deletePermission: RequestHandler = asyncHandler(async (req: Request, res: Response) => {
  const permission = await Permission.findById(req.params.id);

  if (permission) {
    await permission.deleteOne();
    res.json({ message: "Permission removed" });
  } else {
    res.status(404);
    throw new Error("Permission not found");
  }
});

export { getPermissions, createPermission, updatePermission, deletePermission };
