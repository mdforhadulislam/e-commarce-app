import multer, { type FileFilterCallback } from "multer";
import path from "path";
import type { Request, Response, NextFunction } from "express";

// Configure multer for memory storage
const storage = multer.memoryStorage();

// File filter to accept only images
const fileFilter = (
  req: Request,
  file: Express.Multer.File,
  cb: FileFilterCallback
): void => {
  // Accept images only
  if (!file.mimetype.startsWith("image/")) {
    cb(new Error("Only image files are allowed!"));
    return;
  }

  // Check file extension
  const allowedExtensions = [".jpg", ".jpeg", ".png", ".gif", ".webp"];
  const ext = path.extname(file.originalname).toLowerCase();

  if (!allowedExtensions.includes(ext)) {
    cb(
      new Error("Invalid file extension. Allowed: jpg, jpeg, png, gif, webp")
    );
    return;
  }

  cb(null, true);
};

// Create multer upload instance
const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB max file size
  },
});

// Multer error handler middleware
export const handleMulterError = (
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
): void | Response => {
  if (err instanceof multer.MulterError) {
    if (err.code === "LIMIT_FILE_SIZE") {
      return res.status(400).json({
        message: "File is too large. Maximum size is 5MB.",
        error: err.code,
      });
    }
    return res.status(400).json({
      message: err.message,
      error: err.code,
    });
  } else if (err) {
    return res.status(400).json({
      message: err.message || "File upload error",
    });
  }
  next();
};

export default upload;
