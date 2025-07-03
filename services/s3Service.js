const {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
} = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");
const logger = require("../utils/logger");
const {
  AWS_ACCESS_KEY_ID,
  AWS_SECRET_ACCESS_KEY,
  AWS_REGION,
  S3_BUCKET_NAME,
  CLOUDFRONT_URL,
} = require("../utils/constants");

// Lazy-load S3 client to ensure environment variables are loaded
let s3Client = null;

const getS3Client = () => {
  if (!s3Client) {
    // Validate AWS credentials
    if (!AWS_ACCESS_KEY_ID || !AWS_SECRET_ACCESS_KEY || !AWS_REGION) {
      throw new Error("AWS credentials not properly configured");
    }

    // Configure AWS S3 Client
    s3Client = new S3Client({
      region: AWS_REGION,
      credentials: {
        accessKeyId: AWS_ACCESS_KEY_ID,
        secretAccessKey: AWS_SECRET_ACCESS_KEY,
      },
    });
  }
  return s3Client;
};

/**
 * Generate a presigned URL for uploading a file to S3
 * @param {string} key - The S3 key (file path) for the upload
 * @param {string} contentType - The MIME type of the file
 * @param {number} expiresIn - URL expiration time in seconds (default: 900 = 15 minutes)
 * @returns {Promise<string>} - The presigned URL
 */
const generatePresignedUploadUrl = async (
  key,
  contentType,
  expiresIn = 900
) => {
  try {
    // Check if S3 configuration is available
    if (!S3_BUCKET_NAME) {
      throw new Error("S3 bucket name not configured");
    }

    const client = getS3Client();

    const command = new PutObjectCommand({
      Bucket: S3_BUCKET_NAME,
      Key: key,
      ContentType: contentType,
      ACL: "public-read", // Make the file publicly readable
    });

    const presignedUrl = await getSignedUrl(client, command, {
      expiresIn,
    });

    logger.info(`Generated presigned upload URL for key: ${key}`);
    return presignedUrl;
  } catch (error) {
    logger.error(`Failed to generate presigned upload URL: ${error.message}`);
    throw error;
  }
};

/**
 * Delete a file from S3
 * @param {string} key - The S3 key (file path) to delete
 * @returns {Promise<boolean>} - Success status
 */
const deleteFile = async (key) => {
  try {
    // Check if S3 configuration is available
    if (!S3_BUCKET_NAME) {
      throw new Error("S3 bucket name not configured");
    }

    const client = getS3Client();

    const command = new DeleteObjectCommand({
      Bucket: S3_BUCKET_NAME,
      Key: key,
    });

    await client.send(command);
    logger.info(`Successfully deleted file from S3: ${key}`);
    return true;
  } catch (error) {
    logger.error(`Failed to delete file from S3: ${error.message}`);
    throw error;
  }
};

/**
 * Extract S3 key from CloudFront URL
 * @param {string} cloudFrontUrl - The full CloudFront URL
 * @returns {string} - The S3 key (file path)
 */
const extractS3KeyFromCloudFrontUrl = (cloudFrontUrl) => {
  try {
    if (!cloudFrontUrl || !CLOUDFRONT_URL) {
      return null;
    }

    // Remove the CloudFront domain to get the S3 key
    const cloudFrontDomain = CLOUDFRONT_URL.replace(/^https?:\/\//, "");
    const s3Key = cloudFrontUrl
      .replace(/^https?:\/\//, "")
      .replace(cloudFrontDomain, "")
      .replace(/^\//, ""); // Remove leading slash

    return s3Key;
  } catch (error) {
    logger.error(
      `Failed to extract S3 key from CloudFront URL: ${error.message}`
    );
    return null;
  }
};

/**
 * Generate CloudFront URL from S3 key
 * @param {string} s3Key - The S3 key (file path)
 * @returns {string} - The full CloudFront URL
 */
const generateCloudFrontUrl = (s3Key) => {
  if (!s3Key || !CLOUDFRONT_URL) {
    return null;
  }

  // Ensure CloudFront URL doesn't end with slash and s3Key doesn't start with slash
  const baseUrl = CLOUDFRONT_URL.replace(/\/$/, "");
  const key = s3Key.replace(/^\//, "");

  return `${baseUrl}/${key}`;
};

/**
 * Generate avatar file name with timestamp
 * @param {string} userId - The user's MongoDB ID
 * @param {string} fileExtension - The file extension (e.g., 'jpg', 'png')
 * @returns {string} - The generated filename
 */
const generateAvatarFileName = (userId, fileExtension) => {
  const timestamp = Date.now();
  return `avatar_${userId}_${timestamp}.${fileExtension}`;
};

/**
 * Generate avatar S3 key (full path)
 * @param {string} userId - The user's MongoDB ID
 * @param {string} fileExtension - The file extension (e.g., 'jpg', 'png')
 * @returns {string} - The S3 key for the avatar
 */
const generateAvatarS3Key = (userId, fileExtension) => {
  const fileName = generateAvatarFileName(userId, fileExtension);
  return `${userId}/${fileName}`;
};

/**
 * Generate character reference image file name with timestamp
 * @param {string} characterId - The character's MongoDB ID
 * @param {string} fileExtension - The file extension (e.g., 'jpg', 'png')
 * @returns {string} - The generated filename
 */
const generateCharacterImageFileName = (characterId, fileExtension) => {
  const timestamp = Date.now();
  return `character_${characterId}_${timestamp}.${fileExtension}`;
};

/**
 * Generate character reference image S3 key
 * @param {string} userId - The user's MongoDB ID
 * @param {string} characterId - The character's MongoDB ID
 * @param {string} fileExtension - The file extension (e.g., 'jpg', 'png')
 * @returns {string} - The S3 key for the character reference image
 */
const generateCharacterImageS3Key = (userId, characterId, fileExtension) => {
  const fileName = generateCharacterImageFileName(characterId, fileExtension);
  return `${userId}/characters/${characterId}/${fileName}`;
};

/**
 * Validate file type for avatar upload
 * @param {string} contentType - The MIME type of the file
 * @returns {boolean} - Whether the file type is valid
 */
const isValidAvatarFileType = (contentType) => {
  const allowedTypes = ["image/jpeg", "image/jpg", "image/png"];
  return allowedTypes.includes(contentType.toLowerCase());
};

/**
 * Get file extension from content type
 * @param {string} contentType - The MIME type of the file
 * @returns {string} - The file extension
 */
const getFileExtensionFromContentType = (contentType) => {
  const typeMap = {
    "image/jpeg": "jpg",
    "image/jpg": "jpg",
    "image/png": "png",
  };
  return typeMap[contentType.toLowerCase()] || "jpg";
};

module.exports = {
  generatePresignedUploadUrl,
  deleteFile,
  extractS3KeyFromCloudFrontUrl,
  generateCloudFrontUrl,
  generateAvatarFileName,
  generateAvatarS3Key,
  generateCharacterImageFileName,
  generateCharacterImageS3Key,
  isValidAvatarFileType,
  getFileExtensionFromContentType,
};
