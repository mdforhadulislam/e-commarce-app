import type { Request, Response, NextFunction } from "express";

// Read-only users middleware
// Prevents designated users from performing CRUD operations via API

// List of users with read-only access
const READ_ONLY_USERS: string[] = [
  "test@gmail.com",
  // Add more read-only user emails here
];

/**
 * Middleware to prevent read-only users from making changes
 * Should be applied after authMiddleware
 */
const preventReadOnlyActions = (
  req: Request,
  res: Response,
  next: NextFunction
): void | Response => {
  try {
    const userEmail = req.user?.email;
    const httpMethod = req.method;

    // Methods that modify data
    const modifyingMethods = ["POST", "PUT", "PATCH", "DELETE"];

    // Check if user is read-only and trying to modify data
    if (
      userEmail &&
      READ_ONLY_USERS.includes(userEmail.toLowerCase()) &&
      modifyingMethods.includes(httpMethod)
    ) {
      return res.status(403).json({
        success: false,
        message:
          "Access denied: You have read-only permissions and cannot perform this action",
        code: "READ_ONLY_USER",
      });
    }

    // User is not read-only or is performing a read operation
    next();
  } catch (error) {
    console.error("Read-only middleware error:", error);
    next(); // Continue if there's an error to avoid blocking legitimate requests
  }
};

/**
 * Check if a user is read-only (helper function)
 */
const isReadOnlyUser = (email: string | undefined): boolean => {
  if (!email) return false;
  return READ_ONLY_USERS.includes(email.toLowerCase());
};

export { preventReadOnlyActions, isReadOnlyUser, READ_ONLY_USERS };
