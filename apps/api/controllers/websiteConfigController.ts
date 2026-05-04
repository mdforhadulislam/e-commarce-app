// @ts-nocheck
import { Request, Response, NextFunction } from "express"; type RequestHandler = any;
import asyncHandler from "express-async-handler";
import WebsiteConfig from "../models/websiteConfigModel.js";

// @desc    Get all website configurations with optional filters
// @route   GET /api/website-config
// @access  Private/Admin
const getWebsiteConfigs: RequestHandler = asyncHandler(async (req, res) => {
  const { pageType, isActive } = req.query as any;

  const query: any = {};
  if (pageType) query.pageType = pageType;
  if (isActive !== undefined) query.isActive = isActive === "true";

  const configs = await WebsiteConfig.find(query)
    .populate("settings.bannerId", "image title link")
    .populate("settings.bannerIds", "image title link")
    .populate("settings.productFilter.category", "name slug")
    .populate("settings.productFilter.brand", "name slug")
    .populate("settings.categoryIds", "name slug image")
    .populate("settings.brandIds", "name slug logo")
    .populate("createdBy", "name email")
    .populate("updatedBy", "name email")
    .sort({ pageType: 1, weight: 1 });

  res.json({
    success: true,
    count: configs.length,
    data: configs,
  });
});

// @desc    Get website configurations by page type
// @route   GET /api/website-config/page/:pageType
// @access  Public
const getConfigsByPageType: RequestHandler = asyncHandler(async (req, res) => {
  const { pageType } = req.params;

  const configs = await WebsiteConfig.find({
    pageType,
    isActive: true,
  })
    .populate("settings.bannerId", "image title link")
    .populate("settings.bannerIds", "image title link")
    .populate("settings.productFilter.category", "name slug")
    .populate("settings.productFilter.brand", "name slug")
    .populate("settings.categoryIds", "name slug image")
    .populate("settings.brandIds", "name slug logo")
    .sort({ weight: 1 });

  res.json({
    success: true,
    count: configs.length,
    data: configs,
  });
});

// @desc    Get single website configuration
// @route   GET /api/website-config/:id
// @access  Private/Admin
const getWebsiteConfigById: RequestHandler = asyncHandler(async (req, res) => {
  const config = await WebsiteConfig.findById(req.params.id)
    .populate("settings.bannerId", "image title link")
    .populate("settings.bannerIds", "image title link")
    .populate("settings.productFilter.category", "name slug")
    .populate("settings.productFilter.brand", "name slug")
    .populate("settings.categoryIds", "name slug image")
    .populate("settings.brandIds", "name slug logo")
    .populate("createdBy", "name email")
    .populate("updatedBy", "name email");

  if (!config) {
    res.status(404);
    throw new Error("Configuration not found");
  }

  res.json({
    success: true,
    data: config,
  });
});

// @desc    Create new website configuration
// @route   POST /api/website-config
// @access  Private/Admin
const createWebsiteConfig: RequestHandler = asyncHandler(async (req, res) => {
  const {
    pageType,
    componentType,
    title,
    description,
    weight,
    isActive,
    settings,
  } = req.body as any;

  // Validation
  if (!pageType || !componentType || !title) {
    res.status(400);
    throw new Error("Page type, component type, and title are required");
  }

  // Check if weight is already taken for this page
  const existingConfig = await WebsiteConfig.findOne({
    pageType,
    weight,
  });

  if (existingConfig) {
    res.status(400);
    throw new Error(
      `Weight ${weight} is already taken for ${pageType} page. Please choose a different weight or update the existing configuration.`
    );
  }

  const config = await WebsiteConfig.create({
    pageType,
    componentType,
    title,
    description,
    weight: weight || 0,
    isActive: isActive !== undefined ? isActive : true,
    settings: settings || {},
    createdBy: req.user._id,
  });

  const populatedConfig = await WebsiteConfig.findById(config._id)
    .populate("settings.bannerId", "image title link")
    .populate("settings.bannerIds", "image title link")
    .populate("settings.productFilter.category", "name slug")
    .populate("settings.productFilter.brand", "name slug")
    .populate("settings.categoryIds", "name slug image")
    .populate("settings.brandIds", "name slug logo")
    .populate("createdBy", "name email");

  res.status(201).json({
    success: true,
    message: "Configuration created successfully",
    data: populatedConfig,
  });
});

// @desc    Update website configuration
// @route   PUT /api/website-config/:id
// @access  Private/Admin
const updateWebsiteConfig: RequestHandler = asyncHandler(async (req, res) => {
  const {
    pageType,
    componentType,
    title,
    description,
    weight,
    isActive,
    settings,
  } = req.body as any;

  let config = await WebsiteConfig.findById(req.params.id);

  if (!config) {
    res.status(404);
    throw new Error("Configuration not found");
  }

  // If weight is being changed, check if it's already taken
  if (weight !== undefined && weight !== config.weight) {
    const existingConfig = await WebsiteConfig.findOne({
      pageType: pageType || config.pageType,
      weight,
      _id: { $ne: req.params.id },
    });

    if (existingConfig) {
      res.status(400);
      throw new Error(
        `Weight ${weight} is already taken for ${pageType || config.pageType} page. Please choose a different weight.`
      );
    }
  }

  config.pageType = pageType || config.pageType;
  config.componentType = componentType || config.componentType;
  config.title = title || config.title;
  config.description =
    description !== undefined ? description : config.description;
  config.weight = weight !== undefined ? weight : config.weight;
  config.isActive = isActive !== undefined ? isActive : config.isActive;
  config.settings = settings || config.settings;
  config.updatedBy = req.user._id;

  await config.save();

  const updatedConfig = await WebsiteConfig.findById(config._id)
    .populate("settings.bannerId", "image title link")
    .populate("settings.bannerIds", "image title link")
    .populate("settings.productFilter.category", "name slug")
    .populate("settings.productFilter.brand", "name slug")
    .populate("settings.categoryIds", "name slug image")
    .populate("settings.brandIds", "name slug logo")
    .populate("createdBy", "name email")
    .populate("updatedBy", "name email");

  res.json({
    success: true,
    message: "Configuration updated successfully",
    data: updatedConfig,
  });
});

// @desc    Delete website configuration
// @route   DELETE /api/website-config/:id
// @access  Private/Admin
const deleteWebsiteConfig: RequestHandler = asyncHandler(async (req, res) => {
  const config = await WebsiteConfig.findById(req.params.id);

  if (!config) {
    res.status(404);
    throw new Error("Configuration not found");
  }

  await config.deleteOne();

  res.json({
    success: true,
    message: "Configuration deleted successfully",
  });
});

// @desc    Reorder website configurations
// @route   PUT /api/website-config/reorder
// @access  Private/Admin
const reorderWebsiteConfigs: RequestHandler = asyncHandler(async (req, res) => {
  const { pageType, configs } = req.body as any;

  if (!pageType || !Array.isArray(configs)) {
    res.status(400);
    throw new Error("Page type and configs array are required");
  }

  // Update weights in bulk
  const updatePromises = configs.map((item, index) =>
    WebsiteConfig.findByIdAndUpdate(item.id || item._id, {
      weight: index,
      updatedBy: req.user._id,
    })
  );

  await Promise.all(updatePromises);

  const updatedConfigs = await WebsiteConfig.find({ pageType, isActive: true })
    .populate("settings.bannerId", "image title link")
    .populate("settings.bannerIds", "image title link")
    .populate("settings.productFilter.category", "name slug")
    .populate("settings.productFilter.brand", "name slug")
    .populate("settings.categoryIds", "name slug image")
    .populate("settings.brandIds", "name slug logo")
    .sort({ weight: 1 });

  res.json({
    success: true,
    message: "Configurations reordered successfully",
    data: updatedConfigs,
  });
});

// @desc    Toggle configuration status
// @route   PATCH /api/website-config/:id/toggle
// @access  Private/Admin
const toggleConfigStatus: RequestHandler = asyncHandler(async (req, res) => {
  const config = await WebsiteConfig.findById(req.params.id);

  if (!config) {
    res.status(404);
    throw new Error("Configuration not found");
  }

  config.isActive = !config.isActive;
  config.updatedBy = req.user._id;
  await config.save();

  res.json({
    success: true,
    message: `Configuration ${config.isActive ? "activated" : "deactivated"} successfully`,
    data: {
      _id: config._id,
      isActive: config.isActive,
    },
  });
});

export {
  getWebsiteConfigs,
  getConfigsByPageType,
  getWebsiteConfigById,
  createWebsiteConfig,
  updateWebsiteConfig,
  deleteWebsiteConfig,
  reorderWebsiteConfigs,
  toggleConfigStatus,
};
