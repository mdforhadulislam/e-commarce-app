import { RequestHandler } from "express";
import asyncHandler from "express-async-handler";
import ComponentType from "../models/componentTypeModel.js";
import { RequestWithQuery, RequestWithBody } from "../types/express.js";

interface ComponentTypeQuery {
  active?: string;
}

interface ComponentTypeBody {
  name: string;
  label: string;
  description?: string;
  icon?: string;
  structure?: any;
  isActive?: boolean;
}

// @desc    Get all component types
// @route   GET /api/component-types
// @access  Public
export const getComponentTypes: RequestHandler = asyncHandler(async (req: RequestWithQuery<ComponentTypeQuery>, res) => {
  const { active } = req.query;

  const filter: Record<string, any> = {};
  if (active === "true") {
    filter.isActive = true;
  }

  const componentTypes = await ComponentType.find(filter)
    .populate("createdBy", "name email")
    .populate("updatedBy", "name email")
    .sort({ name: 1 });

  res.status(200).json({
    success: true,
    count: componentTypes.length,
    data: componentTypes,
  });
});

// @desc    Get single component type
// @route   GET /api/component-types/:id
// @access  Public
export const getComponentTypeById: RequestHandler = asyncHandler(async (req, res) => {
  const componentType = await ComponentType.findById(req.params.id)
    .populate("createdBy", "name email")
    .populate("updatedBy", "name email");

  if (!componentType) {
    res.status(404);
    throw new Error("Component type not found");
  }

  res.status(200).json({
    success: true,
    data: componentType,
  });
});

// @desc    Create component type
// @route   POST /api/component-types
// @access  Private/Admin
export const createComponentType: RequestHandler = asyncHandler(async (req: RequestWithBody<ComponentTypeBody>, res) => {
  const { name, label, description, icon, structure, isActive } = req.body;

  // Check if component type already exists
  const existingType = await ComponentType.findOne({
    name: name.toLowerCase().trim(),
  });

  if (existingType) {
    res.status(400);
    throw new Error("Component type with this name already exists");
  }

  const componentType = await ComponentType.create({
    name: name.toLowerCase().trim(),
    label,
    description,
    icon,
    structure: structure || {},
    isActive: isActive !== undefined ? isActive : true,
    createdBy: req.user._id,
    updatedBy: req.user._id,
  });

  const populatedType = await ComponentType.findById(componentType._id)
    .populate("createdBy", "name email")
    .populate("updatedBy", "name email");

  res.status(201).json({
    success: true,
    data: populatedType,
  });
});

// @desc    Update component type
// @route   PUT /api/component-types/:id
// @access  Private/Admin
export const updateComponentType: RequestHandler = asyncHandler(async (req: RequestWithBody<ComponentTypeBody>, res) => {
  const { name, label, description, icon, structure, isActive } = req.body;

  const componentType = await ComponentType.findById(req.params.id);

  if (!componentType) {
    res.status(404);
    throw new Error("Component type not found");
  }

  // Check if new name conflicts with existing
  if (name && name.toLowerCase().trim() !== componentType.name) {
    const existingType = await ComponentType.findOne({
      name: name.toLowerCase().trim(),
      _id: { $ne: req.params.id },
    });

    if (existingType) {
      res.status(400);
      throw new Error("Component type with this name already exists");
    }
    componentType.name = name.toLowerCase().trim();
  }

  if (label) componentType.label = label;
  if (description !== undefined) componentType.description = description;
  if (icon) componentType.icon = icon;
  if (structure !== undefined) componentType.structure = structure;
  if (isActive !== undefined) componentType.isActive = isActive;
  componentType.updatedBy = req.user._id;

  const updatedType = await componentType.save();

  const populatedType = await ComponentType.findById(updatedType._id)
    .populate("createdBy", "name email")
    .populate("updatedBy", "name email");

  res.status(200).json({
    success: true,
    data: populatedType,
  });
});

// @desc    Delete component type
// @route   DELETE /api/component-types/:id
// @access  Private/Admin
export const deleteComponentType: RequestHandler = asyncHandler(async (req, res) => {
  const componentType = await ComponentType.findById(req.params.id);

  if (!componentType) {
    res.status(404);
    throw new Error("Component type not found");
  }

  await componentType.deleteOne();

  res.status(200).json({
    success: true,
    message: "Component type deleted successfully",
  });
});

// @desc    Toggle component type status
// @route   PATCH /api/component-types/:id/toggle
// @access  Private/Admin
export const toggleComponentTypeStatus: RequestHandler = asyncHandler(async (req, res) => {
  const componentType = await ComponentType.findById(req.params.id);

  if (!componentType) {
    res.status(404);
    throw new Error("Component type not found");
  }

  componentType.isActive = !componentType.isActive;
  componentType.updatedBy = req.user._id;

  const updatedType = await componentType.save();

  res.status(200).json({
    success: true,
    data: updatedType,
  });
});
