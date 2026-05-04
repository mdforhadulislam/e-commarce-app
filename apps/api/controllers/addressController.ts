import { RequestHandler } from "express";
import asyncHandler from "express-async-handler";
import User from "../models/userModel.js";
import { PaginationQuery, RequestWithQuery } from "../types/express.js";
import { PipelineStage } from "mongoose";

// @desc    Get all addresses from all users
// @route   GET /api/addresses
// @access  Private/Admin
const getAllAddresses: RequestHandler = asyncHandler(async (req: RequestWithQuery<PaginationQuery>, res) => {
  const { page = "1", limit = "20", search } = req.query;

  const pageNum = parseInt(page);
  const limitNum = parseInt(limit);
  const skip = (pageNum - 1) * limitNum;

  try {
    // Build aggregation pipeline
    let pipeline: PipelineStage[] = [
      // Unwind addresses array to get individual addresses
      { $unwind: "$addresses" },
      {
        $project: {
          _id: "$addresses._id",
          userId: "$_id",
          userName: "$name",
          userEmail: "$email",
          street: "$addresses.street",
          city: "$addresses.city",
          state: "$addresses.state",
          country: "$addresses.country",
          postalCode: "$addresses.postalCode",
          isDefault: "$addresses.isDefault",
        },
      },
    ];

    // Add search filter if provided
    if (search) {
      pipeline.push({
        $match: {
          $or: [
            { userName: { $regex: search, $options: "i" } },
            { userEmail: { $regex: search, $options: "i" } },
            { street: { $regex: search, $options: "i" } },
            { city: { $regex: search, $options: "i" } },
            { state: { $regex: search, $options: "i" } },
            { postalCode: { $regex: search, $options: "i" } },
          ],
        },
      });
    }

    // Get total count
    const countPipeline = [...pipeline, { $count: "total" }];
    const countResult = await User.aggregate(countPipeline);
    const total = countResult.length > 0 ? countResult[0].total : 0;

    // Add pagination
    pipeline.push(
      { $sort: { userName: 1 } },
      { $skip: skip },
      { $limit: limitNum }
    );

    // Execute query
    const addresses = await User.aggregate(pipeline);

    const totalPages = Math.ceil(total / limitNum);

    res.json({
      addresses,
      total,
      totalPages,
      currentPage: pageNum,
      perPage: limitNum,
      hasNextPage: pageNum < totalPages,
      hasPrevPage: pageNum > 1,
    });
  } catch (error) {
    console.error("Error fetching addresses:", error);
    res.status(500);
    throw new Error("Failed to fetch addresses");
  }
});

// @desc    Get addresses for a specific user
// @route   GET /api/addresses/user/:userId
// @access  Private
const getUserAddresses: RequestHandler = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.userId).select("addresses");

  if (!user) {
    res.status(404);
    throw new Error("User not found");
  }

  res.json({
    addresses: user.addresses,
    total: user.addresses.length,
  });
});

export { getAllAddresses, getUserAddresses };
