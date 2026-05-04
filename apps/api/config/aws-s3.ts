import dotenv from "dotenv";
import { S3Client } from "@aws-sdk/client-s3";

dotenv.config();

// Configure AWS S3
const s3Client = new S3Client({
  region: process.env.AWS_REGION || "us-east-1",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID as string,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY as string,
  },
});

export interface S3Config {
  client: S3Client;
  bucketName: string | undefined;
  region: string;
}

export const S3_CONFIG: S3Config = {
  client: s3Client,
  bucketName: process.env.AWS_S3_BUCKET_NAME,
  region: process.env.AWS_REGION || "us-east-1",
};

export default s3Client;
