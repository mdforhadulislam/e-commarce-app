import { RequestHandler } from "express";
import jwt, { type SignOptions } from "jsonwebtoken";
import type { JwtPayload } from "../types/index.js";
import asyncHandler from "express-async-handler";
import User from "../models/userModel.js";
import UserRole from "../models/userRoleModel.js";
import generateToken from "../utils/generateToken.js";
import crypto from "crypto";
import { 
  sendPasswordResetEmail, 
  sendVerificationEmail 
} from "../utils/emailService.js";
import { RequestWithBody } from "../types/express.js";

// Interfaces
interface LoginBody {
  email?: string;
  password?: string;
}

interface RegisterBody {
  name: string;
  email: string;
  password?: string;
  role?: string;
  employee_role?: string;
}

interface OAuthBody {
  name: string;
  email: string;
  avatar?: string;
  authProvider: string;
  authUid: string;
  isOAuthUser?: boolean;
}

interface SetPasswordBody {
  password?: string;
}

interface ForgotPasswordBody {
  email?: string;
}

interface ResetPasswordBody {
  token?: string;
  password?: string;
}

interface RefreshTokenBody {
  refreshToken?: string;
}

interface VerifyEmailBody {
  token?: string;
}

// @desc    Auth user & get token
// @route   POST /api/auth/login
// @access  Public
const loginUser: RequestHandler = asyncHandler(async (req: RequestWithBody<LoginBody>, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    res.status(400);
    throw new Error("Please provide email and password");
  }

  const user = await User.findOne({ email });

  // Check if user exists
  if (!user) {
    res.status(401);
    throw new Error("Invalid email or password");
  }

  // Check if user registered via OAuth
  if (user.authProvider && user.authProvider !== "local") {
    res.status(401);
    const providerName =
      user.authProvider.charAt(0).toUpperCase() + user.authProvider.slice(1);
    throw new Error(
      `This account uses ${providerName} sign-in. Please use ${providerName} to login.`
    );
  }

  // Verify password
  if (await user.matchPassword(password)) {
    // Fetch permissions for the user's role
    const userRole = await UserRole.findOne({ value: user.role });
    const permissions = userRole ? userRole.permissions : [];

    res.json({
      _id: user._id,
      name: user.name,
      email: user.email,
      avatar: user.avatar,
      role: user.role,
      permissions,
      employee_role: user.employee_role,
      addresses: user.addresses || [],
      isOAuthUser: user.isOAuthUser || false,
      authProvider: user.authProvider || "local",
      hasSetPassword: user.hasSetPassword || true,
      emailVerified: user.emailVerified,
      ...generateToken(user._id),
    });
  } else {
    res.status(401);
    throw new Error("Invalid email or password");
  }
});

// @desc    Register a new user
// @route   POST /api/auth/register
// @access  Public
const registerUser: RequestHandler = asyncHandler(async (req: RequestWithBody<RegisterBody>, res) => {
  let { name, email, password, role, employee_role } = req.body;

  // Set default role to "user" if not provided
  if (!role) {
    role = "user";
  }

  if (!name || !email || !password) {
    res.status(400);
    throw new Error("Please provide name, email and password");
  }

  const userExists = await User.findOne({ email });

  if (userExists) {
    res.status(400);
    // Provide helpful message if OAuth user tries to register with email/password
    if (userExists.authProvider && userExists.authProvider !== "local") {
      const providerName =
        userExists.authProvider.charAt(0).toUpperCase() +
        userExists.authProvider.slice(1);
      throw new Error(
        `This email is already registered with ${providerName}. Please sign in with ${providerName}.`
      );
    }
    throw new Error("User already exists");
  }

  const user = await User.create({
    name,
    email,
    password,
    role,
    employee_role: role === "employee" ? employee_role : null,
    addresses: [],
  });

  if (user) {
    // Generate verification token
    const verificationToken = crypto.randomBytes(32).toString("hex");
    const hashedToken = crypto
      .createHash("sha256")
      .update(verificationToken)
      .digest("hex");

    // Save token to user
    user.verificationToken = hashedToken;
    user.verificationTokenExpire = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
    await user.save({ validateBeforeSave: false });

    // Send verification email
    const verifyUrl = `${process.env.CLIENT_URL || "http://localhost:3000"}/verify-email/${verificationToken}`;
    
    try {
        await sendVerificationEmail(user.email, user.name, verifyUrl);
    } catch (error) {
        console.error("Failed to send verification email:", error);
    }

    // Fetch permissions for the user's role (usually 'user' default role)
    const userRole = await UserRole.findOne({ value: user.role });
    const permissions = userRole ? userRole.permissions : [];

    res.status(201).json({
      _id: user._id,
      name: user.name,
      email: user.email,
      avatar: user.avatar,
      role: user.role,
      permissions,
      employee_role: user.employee_role,
      addresses: user.addresses,
      isOAuthUser: user.isOAuthUser || false,
      authProvider: user.authProvider || "local",
      hasSetPassword: user.hasSetPassword || true,
      emailVerified: user.emailVerified,
      ...generateToken(user._id),
    });
  } else {
    res.status(400);
    throw new Error("Invalid user data");
  }
});

// @desc    Get user profile
// @route   GET /api/auth/profile
// @access  Private
const getUserProfile: RequestHandler = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id);

  if (user) {
    const userRole = await UserRole.findOne({ value: user.role });
    const permissions = userRole ? userRole.permissions : [];

    res.json({
      _id: user._id,
      name: user.name,
      email: user.email,
      avatar: user.avatar,
      role: user.role,
      permissions,
      employee_role: user.employee_role,
      addresses: user.addresses || [],
      isOAuthUser: user.isOAuthUser || false,
      authProvider: user.authProvider || "local",
      hasSetPassword: user.hasSetPassword || true,
      emailVerified: user.emailVerified,
    });
  } else {
    res.status(404);
    throw new Error("User not found");
  }
});

// @desc    Logout user
// @route   POST /api/auth/logout
// @access  Private
const logoutUser: RequestHandler = asyncHandler(async (req, res) => {
  res.json({
    success: true,
    message: "Logged out successfully",
  });
});

// @desc    OAuth authentication (Google/GitHub)
// @route   POST /api/auth/oauth
// @access  Public
const oauthAuthentication: RequestHandler = async (req: RequestWithBody<OAuthBody>, res) => {
  const { name, email, avatar, authProvider, authUid } = req.body;

  console.log("OAuth authentication request:", {
    email,
    authProvider,
    hasAvatar: !!avatar,
    avatarLength: avatar ? avatar.length : 0,
  });

  // Validate required fields
  if (!email || !authProvider || !authUid) {
     res.status(400).json({
      success: false,
      message: "Email, auth provider, and auth UID are required",
    });
    return;
  }

  // Check if provider is supported
  if (!["google", "github"].includes(authProvider)) {
     res.status(400).json({
      success: false,
      message: "Unsupported authentication provider",
    });
    return;
  }

  try {
    // Check if user already exists with this email
    let user = await User.findOne({ email });

    if (user) {
      // User exists - check if it's the same OAuth account
      if (
        user.isOAuthUser &&
        user.authProvider === authProvider &&
        (user.authUid === authUid || user.authProvider === "google") // Allow google UID update if same provider
      ) {
        // Same OAuth account or Google account update (handling Firebase vs Native UID diffs)
        
        // Update UID if it's Google and differs (keep sync)
        if (user.authProvider === "google" && user.authUid !== authUid) {
             console.log(`ℹ️ Updating Google OAuth UID for ${email}: ${user.authUid} -> ${authUid}`);
             user.authUid = authUid;
        }

        user.name = name || user.name;
        // Update avatar if provided, otherwise keep existing
        if (avatar && avatar.trim() !== "") {
          user.avatar = avatar;
        }
        await user.save();

        const userRole = await UserRole.findOne({ value: user.role });
        const permissions = userRole ? userRole.permissions : [];

        res.json({
          success: true,
          data: {
            _id: user._id,
            name: user.name,
            email: user.email,
            avatar: user.avatar,
            role: user.role,
            permissions,
            addresses: user.addresses || [],
            isOAuthUser: user.isOAuthUser,
            authProvider: user.authProvider,
            hasSetPassword: user.hasSetPassword,
            emailVerified: user.emailVerified,
            ...generateToken(user._id),
          },
        });
        return;
      } else if (user.authProvider === "local" || !user.isOAuthUser) {
        // Registered with Email/Password -> Block OAuth
         res.status(409).json({
          success: false,
          message:
            "This email is already registered using email and password. Please log in with your password.",
        });
        return;
      } else {
        // Registered with different OAuth provider -> Block
         res.status(409).json({
          success: false,
          message: `This email is already registered using ${
            user.authProvider.charAt(0).toUpperCase() +
            user.authProvider.slice(1)
          }. Please sign in with ${
            user.authProvider.charAt(0).toUpperCase() +
            user.authProvider.slice(1)
          } instead.`,
        });
        return;
      }
    } else {
      // New user - create OAuth account
      // Determine avatar: use OAuth photo if available, otherwise use default
      const defaultAvatar =
        process.env.DEFAULT_USER_IMAGE ||
        "https://res.cloudinary.com/dxkhdqifr/image/upload/v1767712291/user_hz2mcv.png";

      const userAvatar =
        avatar && avatar.trim() !== "" ? avatar : defaultAvatar;

      user = await User.create({
        name: name || email.split("@")[0],
        email,
        avatar: userAvatar,
        role: "user",
        isOAuthUser: true,
        authProvider,
        authUid,
        hasSetPassword: false,
        addresses: [],
        emailVerified: true // OAuth users typically have verified emails
      });

      const userRoleDoc = await UserRole.findOne({ value: user.role });
      const permissions = userRoleDoc ? userRoleDoc.permissions : [];

      res.status(201).json({
        success: true,
        data: {
          _id: user._id,
          name: user.name,
          email: user.email,
          avatar: user.avatar,
          role: user.role,
          permissions,
          addresses: user.addresses,
          isOAuthUser: user.isOAuthUser,
          authProvider: user.authProvider,
          hasSetPassword: user.hasSetPassword,
          emailVerified: user.emailVerified,
          ...generateToken(user._id),
        },
      });
      return;
    }
  } catch (error) {
    console.error("OAuth authentication error:", error);
    const err = error as Error;
    console.error("Error details:", {
      message: err.message,
      stack: err.stack,
      name: err.name,
    });
     res.status(500).json({
      success: false,
      message: err.message || "OAuth authentication failed",
    });
    return;
  }
};

// @desc    Set password for OAuth user
// @route   POST /api/auth/set-password
// @access  Private
const setPasswordForOAuthUser: RequestHandler = asyncHandler(async (req: RequestWithBody<SetPasswordBody>, res) => {
  const { password } = req.body;

  if (!password || password.length < 6) {
    res.status(400);
    throw new Error("Password must be at least 6 characters long");
  }

  const user = await User.findById(req.user._id);

  if (!user) {
    res.status(404);
    throw new Error("User not found");
  }

  // Allow both OAuth users to add password AND regular users to update password
  // No restriction - any authenticated user can set/update their password

  // Set password and mark as set
  user.password = password;
  user.hasSetPassword = true;
  await user.save();

  res.json({
    success: true,
    message: "Password set successfully",
    data: {
      hasSetPassword: user.hasSetPassword,
    },
  });
});

// @desc    Forgot password - send reset email
// @route   POST /api/auth/forgot-password
// @access  Public
const forgotPassword: RequestHandler = asyncHandler(async (req: RequestWithBody<ForgotPasswordBody>, res) => {
  const { email } = req.body;

  if (!email) {
    res.status(400);
    throw new Error("Please provide an email address");
  }

  const user = await User.findOne({ email });

  if (!user) {
    res.status(404);
    throw new Error("No user found with this email address");
  }

  // Generate reset token
  const resetToken = crypto.randomBytes(32).toString("hex");

  // Hash token and set to resetPasswordToken field
  user.resetPasswordToken = crypto
    .createHash("sha256")
    .update(resetToken)
    .digest("hex");

  // Set expire time (1 hour)
  user.resetPasswordExpire = new Date(Date.now() + 60 * 60 * 1000);

  await user.save({ validateBeforeSave: false });

  // Create reset url
  const resetUrl = `${process.env.CLIENT_URL || "http://localhost:3000"}/auth/reset-password?token=${resetToken}`;

  try {
    // Send email
    await sendPasswordResetEmail(user.email, user.name, resetUrl);

    res.status(200).json({
      success: true,
      message: "Password reset email sent",
      data: {
        message: `Email sent to ${user.email}`,
      },
    });
  } catch (error) {
    console.error("Error sending password reset email:", error);
    user.resetPasswordToken = undefined;
    user.resetPasswordExpire = undefined;
    await user.save({ validateBeforeSave: false });

    res.status(500);
    throw new Error("Email could not be sent");
  }
});

// @desc    Reset password
// @route   POST /api/auth/reset-password
// @access  Public
const resetPassword: RequestHandler = asyncHandler(async (req: RequestWithBody<ResetPasswordBody>, res) => {
  const { token, password } = req.body;

  if (!token || !password) {
    res.status(400);
    throw new Error("Please provide token and password");
  }

  if (password.length < 6) {
    res.status(400);
    throw new Error("Password must be at least 6 characters");
  }

  // Hash token
  const resetPasswordToken = crypto
    .createHash("sha256")
    .update(token)
    .digest("hex");

  const user = await User.findOne({
    resetPasswordToken,
    resetPasswordExpire: { $gt: Date.now() },
  });

  if (!user) {
    res.status(400);
    throw new Error("Invalid or expired reset token");
  }

  // Set new password
  user.password = password;
  user.resetPasswordToken = undefined;
  user.resetPasswordExpire = undefined;
  user.hasSetPassword = true;
  await user.save();

  res.status(200).json({
    success: true,
    message: "Password reset successful",
    data: {
      message: "Password has been reset successfully",
    },
  });
});

// @desc    Refresh access token
// @route   POST /api/auth/refresh
// @access  Public
const refreshToken: RequestHandler = asyncHandler(async (req: RequestWithBody<RefreshTokenBody>, res) => {
  const { refreshToken } = req.body;

  if (!refreshToken) {
    res.status(401);
    throw new Error("No refresh token provided");
  }

  try {
    // Verify refresh token
    const decoded = jwt.verify(
      refreshToken,
      process.env.JWT_SECRET as string
    ) as JwtPayload;

    // Get user
    const user = await User.findById(decoded.id);

    if (!user) {
      res.status(401);
      throw new Error("Invalid refresh token");
    }

    // Generate NEW access token (short lived)
    // We do NOT generate a new refresh token here (rotation is optional, keeping it simple for now)
    const accessToken = jwt.sign(
      { id: user._id },
      process.env.JWT_SECRET as string,
      {
        expiresIn: (process.env.JWT_EXPIRE || "15m") as SignOptions["expiresIn"],
      }
    );

    res.json({
      accessToken,
    });
  } catch (error) {
    res.status(401);
    throw new Error("Invalid refresh token");
  }
});

// @desc    Verify email address
// @route   POST /api/auth/verify-email
// @access  Public
const verifyEmail: RequestHandler = asyncHandler(async (req: RequestWithBody<VerifyEmailBody>, res) => {
  const { token } = req.body;

  if (!token) {
    res.status(400);
    throw new Error("Verification token is required");
  }

  const hashedToken = crypto
    .createHash("sha256")
    .update(token)
    .digest("hex");

  const user = await User.findOne({
    verificationToken: hashedToken,
    verificationTokenExpire: { $gt: Date.now() },
  });

  if (!user) {
    res.status(400);
    throw new Error("Invalid or expired verification token");
  }

  user.emailVerified = true;
  user.verificationToken = undefined;
  user.verificationTokenExpire = undefined;
  
  await user.save();

  res.json({
    success: true,
    message: "Email verified successfully",
    data: {
      emailVerified: true,
      hasSetPassword: user.hasSetPassword
    }
  });
});

// @desc    Resend verification email
// @route   POST /api/auth/resend-verification
// @access  Private
const resendVerificationEmail: RequestHandler = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id);

  if (!user) {
    res.status(404);
    throw new Error("User not found");
  }

  if (user.emailVerified) {
    res.status(400);
    throw new Error("Email is already verified");
  }

  // Generate verification token
  const verificationToken = crypto.randomBytes(32).toString("hex");
  const hashedToken = crypto
    .createHash("sha256")
    .update(verificationToken)
    .digest("hex");

  user.verificationToken = hashedToken;
  user.verificationTokenExpire = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
  await user.save({ validateBeforeSave: false });

  const verifyUrl = `${process.env.CLIENT_URL || "http://localhost:3000"}/verify-email/${verificationToken}`;

  try {
    await sendVerificationEmail(user.email, user.name, verifyUrl);
    res.json({
      success: true,
      message: "Verification email sent",
    });
  } catch (error) {
    res.status(500);
    throw new Error("Email could not be sent");
  }
});

export {
  loginUser,
  registerUser,
  getUserProfile,
  logoutUser,
  oauthAuthentication,
  setPasswordForOAuthUser,
  forgotPassword,
  resetPassword,
  refreshToken,
  verifyEmail,
  resendVerificationEmail,
};
