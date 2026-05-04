import cloudinary from "./cloudinary.js";
import { S3_CONFIG } from "./aws-s3.js";
import imagekit from "./imagekit.js";
import { PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import crypto from "crypto";

export interface UploadOptions {
  folder?: string;
  provider?: "cloudinary" | "s3" | "imagekit";
  originalName?: string;
  contentType?: string;
  enableFallback?: boolean;
  transformation?: Array<Record<string, unknown>>;
  isPrivateFile?: boolean; // For ImageKit private file support
}

export interface UploadResult {
  success: boolean;
  provider: "cloudinary" | "s3" | "imagekit";
  url: string;
  publicId?: string;
  key?: string;
  fileId?: string; // For ImageKit
  originalName?: string;
  size?: number;
  format?: string;
  bucket?: string;
}

export interface DeleteResult {
  success: boolean;
  provider: "cloudinary" | "s3" | "imagekit";
}

export interface UploadStats {
  defaultProvider: string;
  availableProviders: string[];
  s3Config: {
    region: string;
    bucket: string | undefined;
  };
}

class UploadService {
  private defaultProvider: "cloudinary" | "s3" | "imagekit";

  constructor() {
    this.defaultProvider =
      (process.env.DEFAULT_UPLOAD_PROVIDER as
        | "cloudinary"
        | "s3"
        | "imagekit") || "cloudinary";
  }

  // Generate unique filename
  generateUniqueFilename(originalName: string, folder = ""): string {
    const timestamp = Date.now();
    const randomString = crypto.randomBytes(6).toString("hex");
    const extension = originalName.split(".").pop();
    const baseName = originalName.split(".").slice(0, -1).join(".");
    const safeName = baseName.replace(/[^a-zA-Z0-9-_]/g, "_");

    const filename = `${safeName}_${timestamp}_${randomString}.${extension}`;
    return folder ? `${folder}/${filename}` : filename;
  }

  // Upload to Cloudinary
  async uploadToCloudinary(
    imageData: string,
    options: UploadOptions = {},
  ): Promise<UploadResult> {
    try {
      const result = await cloudinary.uploader.upload(imageData, {
        folder: options.folder || "babyshop",
        transformation: options.transformation || [
          { width: 800, height: 600, crop: "limit" },
          { quality: "auto", fetch_format: "auto" },
        ],
        ...options,
      });

      return {
        success: true,
        provider: "cloudinary",
        url: result.secure_url,
        publicId: result.public_id,
        originalName: options.originalName,
        size: result.bytes,
        format: result.format,
      };
    } catch (error) {
      const err = error as Error;
      throw new Error(`Cloudinary upload failed: ${err.message}`);
    }
  }

  // Upload to ImageKit
  async uploadToImageKit(
    imageData: string | Buffer,
    options: UploadOptions = {},
  ): Promise<UploadResult> {
    try {
      // Determine file name
      const fileName = options.originalName
        ? this.generateUniqueFilename(options.originalName, "")
            .split("/")
            .pop()!
        : `image_${Date.now()}.jpg`;

      // Convert Buffer to base64 if needed (ImageKit Node SDK v7 expects base64 string for raw data)
      let file: string;
      if (Buffer.isBuffer(imageData)) {
        file = imageData.toString("base64");
      } else if (
        typeof imageData === "string" &&
        imageData.startsWith("data:")
      ) {
        file = imageData;
      } else {
        file = imageData as string;
      }

      const result = await imagekit.files.upload({
        file: file,
        fileName: fileName,
        folder: options.folder || "babyshop",
        tags: options.originalName ? [options.originalName] : [],
        isPrivateFile: options.isPrivateFile || false,
        useUniqueFileName: true,
      });

      return {
        success: true,
        provider: "imagekit",
        url: result.url,
        fileId: result.fileId,
        originalName: options.originalName,
        size: result.size,
        format: (result as any).format,
      };
    } catch (error) {
      const err = error as Error;
      throw new Error(`ImageKit upload failed: ${err.message}`);
    }
  }

  // Upload to AWS S3
  async uploadToS3(
    imageBuffer: Buffer,
    options: UploadOptions = {},
  ): Promise<UploadResult> {
    try {
      const filename = this.generateUniqueFilename(
        options.originalName || "image.jpg",
        options.folder || "babyshop",
      );

      const uploadParams = {
        Bucket: S3_CONFIG.bucketName,
        Key: filename,
        Body: imageBuffer,
        ContentType: options.contentType || "image/jpeg",
        Metadata: {
          "original-name": options.originalName || "",
          "upload-date": new Date().toISOString(),
        },
      };

      const command = new PutObjectCommand(uploadParams);
      await S3_CONFIG.client.send(command);

      const url = `https://${S3_CONFIG.bucketName}.s3.${S3_CONFIG.region}.amazonaws.com/${filename}`;

      return {
        success: true,
        provider: "s3",
        url: url,
        key: filename,
        originalName: options.originalName,
        size: imageBuffer.length,
        bucket: S3_CONFIG.bucketName,
      };
    } catch (error) {
      const err = error as Error;
      throw new Error(`S3 upload failed: ${err.message}`);
    }
  }

  // Main upload method - uses default provider or specified provider
  async uploadImage(
    imageData: string | Buffer,
    options: UploadOptions = {},
  ): Promise<UploadResult> {
    let provider = options.provider || this.defaultProvider;

    // Helper to get fallback provider chain
    const getFallbackChain = (current: string): string[] => {
      const chain: string[] = [];
      // Preference: Cloudinary -> ImageKit -> S3
      if (current === "cloudinary") chain.push("imagekit", "s3");
      else if (current === "imagekit") chain.push("cloudinary", "s3");
      else if (current === "s3") chain.push("cloudinary", "imagekit");
      return chain;
    };

    try {
      if (provider === "s3") {
        // Convert base64 to buffer if needed
        let imageBuffer: Buffer;
        if (typeof imageData === "string" && imageData.startsWith("data:")) {
          // Base64 data URL
          const base64Data = imageData.replace(/^data:image\/\w+;base64,/, "");
          imageBuffer = Buffer.from(base64Data, "base64");

          // Extract content type
          const contentTypeMatch = imageData.match(/^data:([^;]+);/);
          if (contentTypeMatch) {
            options.contentType = contentTypeMatch[1];
          }
        } else if (Buffer.isBuffer(imageData)) {
          imageBuffer = imageData;
        } else {
          throw new Error("Invalid image data format for S3 upload");
        }

        return await this.uploadToS3(imageBuffer, options);
      } else if (provider === "imagekit") {
        return await this.uploadToImageKit(imageData, options);
      } else {
        return await this.uploadToCloudinary(imageData as string, options);
      }
    } catch (error) {
      const err = error as Error;
      console.error(`Upload failed with ${provider}:`, err.message);

      // Fallback logic
      if (options.enableFallback !== false) {
        const chain = getFallbackChain(provider);
        const nextProvider = chain[0] as "cloudinary" | "s3" | "imagekit";

        if (nextProvider) {
          console.log(`Falling back to ${nextProvider}...`);
          try {
            return await this.uploadImage(imageData, {
              ...options,
              provider: nextProvider,
              // Disable fallback for this recursive call to verify simplicity first
              // But wait, if secondary fails, we want tertiary.
              // So we need to enable fallback but AVOID infinite loop.
              // The recursive call will re-calculate fallback chain based on 'nextProvider'.
              // If nextProvider is 'imagekit', chain is ['cloudinary', 's3'].
              // This is the loop derived from getFallbackChain logic.
              // FIX: Explicitly try the remaining providers in order.
              enableFallback: false,
            });
          } catch (fallbackError) {
            // Try tertiary
            const tertiaryProvider = chain[1] as
              | "cloudinary"
              | "s3"
              | "imagekit";
            if (tertiaryProvider) {
              console.log(`Falling back to ${tertiaryProvider} (tertiary)...`);
              try {
                return await this.uploadImage(imageData, {
                  ...options,
                  provider: tertiaryProvider,
                  enableFallback: false,
                });
              } catch (tertiaryError) {
                const terr = tertiaryError as Error;
                throw new Error(
                  `All providers failed. Last error: ${terr.message}`,
                );
              }
            }

            const fallbackErr = fallbackError as Error;
            throw new Error(
              `Upload failed on primary (${provider}) and fallback (${nextProvider}). Error: ${fallbackErr.message}`,
            );
          }
        }
      }

      throw error;
    }
  }

  // Replace image - uploads new image and deletes the old one
  async replaceImage(
    newImageData: string | Buffer,
    oldImageUrl: string | null,
    options: UploadOptions = {},
  ): Promise<UploadResult> {
    try {
      // Upload new image first
      const uploadResult = await this.uploadImage(newImageData, options);

      // If upload successful, delete old image
      if (oldImageUrl && uploadResult.success) {
        try {
          await this.deleteImage(oldImageUrl);
        } catch (deleteError) {
          const err = deleteError as Error;
          console.error(
            `Failed to delete old image ${oldImageUrl}: ${err.message}`,
          );
          // Don't fail the operation if old image deletion fails
        }
      }

      return uploadResult;
    } catch (error) {
      const err = error as Error;
      throw new Error(`Image replacement failed: ${err.message}`);
    }
  }

  // Delete from Cloudinary
  async deleteFromCloudinary(publicId: string): Promise<DeleteResult> {
    try {
      const result = await cloudinary.uploader.destroy(publicId);
      return { success: result.result === "ok", provider: "cloudinary" };
    } catch (error) {
      const err = error as Error;
      throw new Error(`Cloudinary delete failed: ${err.message}`);
    }
  }

  // Delete from ImageKit
  async deleteFromImageKit(fileIdOrUrl: string): Promise<DeleteResult> {
    try {
      let fileId = fileIdOrUrl;

      // If it looks like a URL, we need to find the file ID
      if (fileIdOrUrl.startsWith("http")) {
        // Attempt to resolve file ID from URL/name
        // ImageKit doesn't easily map URL -> FileID directly without lookup
        // Extract filename
        const fileName = fileIdOrUrl.substring(
          fileIdOrUrl.lastIndexOf("/") + 1,
        );

        // Search for file
        const files = await imagekit.assets.list({
          searchQuery: `name = "${fileName}"`,
        });

        if (files && files.length > 0) {
          fileId = (files[0] as any).fileId;
        } else {
          console.warn(`Could not find ImageKit file ID for ${fileIdOrUrl}`);
          return { success: false, provider: "imagekit" }; // Cannot delete
        }
      }

      await imagekit.files.delete(fileId);
      return { success: true, provider: "imagekit" };
    } catch (error) {
      const err = error as Error;
      throw new Error(`ImageKit delete failed: ${err.message}`);
    }
  }

  // Delete from S3
  async deleteFromS3(key: string): Promise<DeleteResult> {
    try {
      const deleteParams = {
        Bucket: S3_CONFIG.bucketName,
        Key: key,
      };

      const command = new DeleteObjectCommand(deleteParams);
      await S3_CONFIG.client.send(command);

      return { success: true, provider: "s3" };
    } catch (error) {
      const err = error as Error;
      throw new Error(`S3 delete failed: ${err.message}`);
    }
  }

  // Delete image (auto-detects provider based on URL or provides key/publicId)
  async deleteImage(
    identifier: string,
    provider: "cloudinary" | "s3" | "imagekit" | null = null,
  ): Promise<DeleteResult> {
    let detectedProvider = provider;
    let processedIdentifier = identifier;

    try {
      if (!detectedProvider) {
        // Auto-detect provider based on URL pattern
        if (typeof identifier === "string") {
          if (identifier.includes("cloudinary.com")) {
            detectedProvider = "cloudinary";
            // Extract public ID from Cloudinary URL
            const matches = identifier.match(/\/v\d+\/(.+)\.[^.]+$/);
            processedIdentifier = matches ? matches[1] : identifier;
          } else if (identifier.includes("imagekit.io")) {
            detectedProvider = "imagekit";
            // Pass full URL to deleteFromImageKit which handles lookup
            processedIdentifier = identifier;
          } else if (
            identifier.includes("amazonaws.com") ||
            identifier.includes("s3.")
          ) {
            detectedProvider = "s3";
            // Extract key from S3 URL
            const matches =
              identifier.match(/amazonaws\.com\/(.+)$/) ||
              identifier.match(/s3\.[^/]+\/[^/]+\/(.+)$/);
            processedIdentifier = matches ? matches[1] : identifier;
          }
        }
      }

      if (detectedProvider === "s3") {
        return await this.deleteFromS3(processedIdentifier);
      } else if (detectedProvider === "imagekit") {
        return await this.deleteFromImageKit(processedIdentifier);
      } else {
        return await this.deleteFromCloudinary(processedIdentifier);
      }
    } catch (error) {
      const err = error as Error;
      console.error("Delete failed:", err.message);
      throw error;
    }
  }

  // Generate presigned URL for S3 (for temporary access)
  async generatePresignedUrl(key: string, expiresIn = 3600): Promise<string> {
    try {
      const command = new PutObjectCommand({
        Bucket: S3_CONFIG.bucketName,
        Key: key,
      });

      const signedUrl = await getSignedUrl(S3_CONFIG.client, command, {
        expiresIn: expiresIn,
      });

      return signedUrl;
    } catch (error) {
      const err = error as Error;
      throw new Error(`Failed to generate presigned URL: ${err.message}`);
    }
  }

  // Get upload statistics
  getUploadStats(): UploadStats {
    return {
      defaultProvider: this.defaultProvider,
      availableProviders: ["cloudinary", "imagekit", "s3"],
      s3Config: {
        region: S3_CONFIG.region,
        bucket: S3_CONFIG.bucketName,
      },
    };
  }
}

// Export singleton instance
const uploadService = new UploadService();
export default uploadService;

// Export convenience methods for backward compatibility
export const uploadToCloudinary = (
  imageData: string,
  folder: string,
): Promise<UploadResult> =>
  uploadService.uploadToCloudinary(imageData, { folder });

export const deleteFromCloudinary = (
  identifier: string,
): Promise<DeleteResult> => uploadService.deleteImage(identifier, "cloudinary");
