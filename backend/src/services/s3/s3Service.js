import '../../config/config.js';
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  ListObjectsV2Command,
  GetObjectCommand
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import fs from "fs";
import path from "path";
import sharp from "sharp";

let _s3 = null;
function getS3() {
  if (!_s3) {
    _s3 = new S3Client({
      region: process.env.S3_REGION || 'us-east-1',
      credentials: {
        accessKeyId: process.env.S3_ACCESS_KEY_ID,
        secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
      },
    });
  }
  return _s3;
}

const getBucket = () => process.env.S3_BUCKET;

// 1. Upload File (buffer or local file)
export async function uploadFile({ fileBuffer, filePath, key, directory = "", contentType = "application/octet-stream" }) {
  try {
    const finalKey = directory ? `${directory}/${key}` : key;
    const bucket = getBucket();

    let Body = fileBuffer;
    if (!fileBuffer && filePath) {
      Body = fs.readFileSync(filePath);
    }

    const cmd = new PutObjectCommand({
      Bucket: bucket,
      Key: finalKey,
      Body,
      ContentType: contentType,
    });

    await getS3().send(cmd);

    return {
      success: true,
      key: finalKey,
      url: `https://${bucket}.s3.amazonaws.com/${finalKey}`,
    };
  } catch (error) {
    console.error("S3 Upload Error:", error);
    throw error;
  }
}

// 2. Get Signed URL to Fetch File
export async function getFileUrl({ key, directory = "", expiresIn = 3600, filename = "" }) {
  try {
    const finalKey = directory ? `${directory}/${key}` : key;
    const bucket = getBucket();

    const cmd = new GetObjectCommand({
      Bucket: bucket,
      Key: finalKey,
      ResponseContentDisposition: filename ? `attachment; filename="${filename}"` : undefined,
    });

    const url = await getSignedUrl(getS3(), cmd, { expiresIn });

    return { success: true, url };
  } catch (error) {
    console.error("S3 Fetch Error:", error);
    throw error;
  }
}

// 3. List Files (supports folders)
export async function listFiles(prefix = "") {
  try {
    const bucket = getBucket();
    const cmd = new ListObjectsV2Command({
      Bucket: bucket,
      Prefix: prefix,  // directory like "uploads/" or ""
    });

    const result = await getS3().send(cmd);

    const files = (result.Contents || []).map((item) => ({
      key: item.Key,
      size: item.Size,
      lastModified: item.LastModified,
    }));

    return { success: true, files };
  } catch (error) {
    console.error("S3 List Error:", error);
    throw error;
  }
}

// 4. Delete File
export async function deleteFile({ key, directory = "" }) {
  try {
    const finalKey = directory ? `${directory}/${key}` : key;
    const bucket = getBucket();

    const cmd = new DeleteObjectCommand({
      Bucket: bucket,
      Key: finalKey,
    });

    await getS3().send(cmd);

    return { success: true, deletedKey: finalKey };
  } catch (error) {
    console.error("S3 Delete Error:", error);
    throw error;
  }
}

// 5. Upload Compressed Image (WebP)
export async function uploadCompressedImage({
  fileBuffer,
  key,
  directory = "",
  width = 800,
  quality = 50
}) {
  try {
    // Process image: Resize -> WebP (supports animation) -> Buffer
    // 'animated: true' allows sharp to handle multi-frame GIFs/WebP
    const processedBuffer = await sharp(fileBuffer, { animated: true })
      .resize({ width, withoutEnlargement: true })
      .webp({ quality, lossless: false })
      .toBuffer();

    // Ensure extension is .webp
    const keyBase = key.replace(/\.[^/.]+$/, ""); // Strip existing extension if any
    const finalKey = `${keyBase}.webp`;

    // Re-use standard upload function
    return await uploadFile({
      fileBuffer: processedBuffer,
      key: finalKey,
      directory,
      contentType: "image/webp"
    });
  } catch (error) {
    console.warn("Compression Upload Error, falling back to raw upload:", error.message);
    return await uploadFile({
      fileBuffer,
      key: `${key.replace(/\.[^/.]+$/, "")}.jpg`,
      directory,
      contentType: "image/jpeg"
    });
  }
}


