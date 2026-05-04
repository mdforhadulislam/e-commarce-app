import type { Request, Response, NextFunction, RequestHandler } from "express";
import jwt from "jsonwebtoken";
import asyncHandler from "express-async-handler";
import User from "../models/userModel.js";
import type { IUser, JwtPayload, EmployeeRole } from "../types/index.js";

// Extend Express Request to include user
declare global {
  namespace Express {
    interface Request {
      user?: IUser;
    }
  }
}

// Protect routes
const protect: RequestHandler = asyncHandler(
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    let token: string | undefined;

    if (
      req.headers.authorization &&
      req.headers.authorization.startsWith("Bearer")
    ) {
      try {
        // Get token from header
        token = req.headers.authorization.split(" ")[1];

        // Check if token exists and is not empty
        if (!token || token === "undefined" || token === "null") {
          res.status(401);
          throw new Error("Not authorized, invalid token");
        }

        // Verify token
        const decoded = jwt.verify(
          token,
          process.env.JWT_SECRET as string
        ) as JwtPayload;

        // Get user from the token
        const user = await User.findById(decoded.id).select("-password");

        if (!user) {
          res.status(401);
          throw new Error("Not authorized, user not found");
        }

        req.user = user as IUser;
        next();
      } catch (error) {
        const err = error as Error & { name?: string };
        // Better error logging for JWT issues
        if (err.name === "JsonWebTokenError") {
          console.error("JWT Error: Token is malformed or invalid");
          res.status(401);
          throw new Error("Not authorized, invalid token format");
        } else if (err.name === "TokenExpiredError") {
          console.error("JWT Error: Token has expired");
          res.status(401);
          throw new Error("Not authorized, token expired");
        } else {
          console.error("Auth error:", err.message);
          res.status(401);
          throw new Error("Not authorized, authentication failed");
        }
      }
    } else {
      res.status(401);
      throw new Error("Not authorized, no token provided");
    }
  }
);

// Admin middleware - only admin role
const admin = (req: Request, res: Response, next: NextFunction): void => {
  if (req.user && req.user.role === "admin") {
    next();
  } else {
    res.status(403);
    throw new Error("Not authorized as an admin");
  }
};

// Employee middleware - admin or employee role
const employee = (req: Request, res: Response, next: NextFunction): void => {
  if (req.user && (req.user.role === "admin" || req.user.role === "employee")) {
    next();
  } else {
    res.status(403);
    throw new Error("Not authorized as an employee");
  }
};

// Incharge middleware - admin or employee with incharge role
const incharge = (req: Request, res: Response, next: NextFunction): void => {
  if (
    req.user &&
    (req.user.role === "admin" ||
      (req.user.role === "employee" && req.user.employee_role === "incharge"))
  ) {
    next();
  } else {
    res.status(403);
    throw new Error("Not authorized as an incharge");
  }
};

// Specific employee role middleware
const requireEmployeeRole = (allowedRoles: EmployeeRole[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401);
      throw new Error("Not authenticated");
    }

    // Admin can access everything
    if (req.user.role === "admin") {
      next();
      return;
    }

    // Check if user is employee with required role
    if (
      req.user.role === "employee" &&
      req.user.employee_role &&
      allowedRoles.includes(req.user.employee_role)
    ) {
      next();
      return;
    }

    res.status(403);
    throw new Error(
      `Access denied. Required roles: ${allowedRoles.join(", ")}`
    );
  };
};

// Specific role middleware functions
const packer = requireEmployeeRole(["packer", "incharge"]);
const deliveryman = requireEmployeeRole(["deliveryman", "incharge"]);
const accounts = requireEmployeeRole(["accounts", "incharge"]);
const callCenter = requireEmployeeRole(["call_center", "incharge"]);

// Check if user can manage roles (admin only)
const canManageRoles = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  if (req.user && req.user.role === "admin") {
    next();
  } else {
    res.status(403);
    throw new Error("Only administrators can manage user roles");
  }
};

// Check if user can assign employee roles (admin or incharge)
const canAssignEmployeeRoles = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  if (
    req.user &&
    (req.user.role === "admin" ||
      (req.user.role === "employee" && req.user.employee_role === "incharge"))
  ) {
    next();
  } else {
    res.status(403);
    throw new Error(
      "Only administrators or incharge can assign employee roles"
    );
  }
};

// Middleware for cash collection - admin or deliveryman
const canCollectCash: RequestHandler = asyncHandler(
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    if (!req.user) {
      console.error("❌ No user found in request");
      res.status(401);
      throw new Error("Not authenticated");
    }

    // Admin can collect cash
    if (req.user.role === "admin") {
      next();
      return;
    }

    // Deliveryman can collect cash
    if (
      req.user.role === "employee" &&
      (req.user.employee_role === "deliveryman" ||
        req.user.employee_role === "incharge")
    ) {
      next();
      return;
    }

    console.error("❌ Access denied - not admin or deliveryman", {
      role: req.user?.role,
      employee_role: req.user?.employee_role,
    });
    res.status(403);
    throw new Error("Only admin or deliveryman can collect cash payments");
  }
);

// Middleware for admin or accounts access
const adminOrAccounts = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  if (!req.user) {
    res.status(401);
    throw new Error("Not authenticated");
  }

  // Admin can access
  if (req.user.role === "admin") {
    next();
    return;
  }

  // Accounts employee can access
  if (
    req.user.role === "employee" &&
    (req.user.employee_role === "accounts" ||
      req.user.employee_role === "incharge")
  ) {
    next();
    return;
  }

  res.status(403);
  throw new Error("Access denied. Admin or accounts access required");
};

// Seller middleware - admin or seller role
const seller = (req: Request, res: Response, next: NextFunction): void => {
  if (req.user && req.user.role === "seller") {
    next();
  } else {
    res.status(403);
    throw new Error("Not authorized as a seller");
  }
};

// Admin or Seller middleware - admin or seller role
const adminOrSeller = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  if (req.user && (req.user.role === "admin" || req.user.role === "seller")) {
    next();
  } else {
    res.status(403);
    throw new Error("Not authorized. Admin or seller access required");
  }
};

export {
  protect,
  admin,
  employee,
  incharge,
  packer,
  deliveryman,
  accounts,
  callCenter,
  requireEmployeeRole,
  canManageRoles,
  canAssignEmployeeRoles,
  canCollectCash,
  adminOrAccounts,
  seller,
  adminOrSeller,
};
