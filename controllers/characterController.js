const { validationResult } = require("express-validator");
const mongoose = require("mongoose");
const characterService = require("../services/characterService");
const s3Service = require("../services/s3Service");
const logger = require("../utils/logger");

/**
 * Get user's characters with pagination
 */
const getCharacters = async (req, res) => {
  try {
    const { page = 1, limit = 12, type } = req.query;
    const userId = req.user._id.toString();

    // Validate pagination parameters
    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(50, Math.max(1, parseInt(limit))); // Max 50 per page

    const result = await characterService.getUserCharacters(
      userId,
      pageNum,
      limitNum,
      type
    );

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    logger.error(`Get characters error: ${error.message}`);
    res.status(500).json({
      success: false,
      message: "Failed to retrieve characters",
    });
  }
};

/**
 * Get a specific character by ID
 */
const getCharacterById = async (req, res) => {
  try {
    // Check for validation errors (including invalid MongoDB ObjectId)
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: "Invalid character ID",
        errors: errors.array(),
      });
    }

    const { id } = req.params;
    const userId = req.user._id.toString();

    // Additional check for valid ObjectId format (in case validation middleware is bypassed)
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid character ID format",
      });
    }

    const character = await characterService.getCharacterById(id, userId);

    if (!character) {
      return res.status(404).json({
        success: false,
        message: "Character not found",
      });
    }

    res.json({
      success: true,
      data: { character },
    });
  } catch (error) {
    logger.error(`Get character by ID error: ${error.message}`);

    // Handle specific MongoDB errors
    if (error.name === "CastError" && error.kind === "ObjectId") {
      return res.status(400).json({
        success: false,
        message: "Invalid character ID format",
      });
    }

    res.status(500).json({
      success: false,
      message: "Failed to retrieve character",
    });
  }
};

/**
 * Create a new character
 */
const createCharacter = async (req, res) => {
  try {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: errors.array(),
      });
    }

    const userId = req.user._id.toString();
    const characterData = req.body;

    const character = await characterService.createCharacter(
      userId,
      characterData
    );

    res.status(201).json({
      success: true,
      message: "Character created successfully",
      data: { character },
    });
  } catch (error) {
    logger.error(`Create character error: ${error.message}`);

    // Handle validation errors
    if (error.name === "ValidationError") {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: Object.values(error.errors).map((err) => ({
          field: err.path,
          message: err.message,
        })),
      });
    }

    res.status(500).json({
      success: false,
      message: "Failed to create character",
    });
  }
};

/**
 * Update a character
 */
const updateCharacter = async (req, res) => {
  try {
    // Check for validation errors (including invalid MongoDB ObjectId)
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: errors.array(),
      });
    }

    const { id } = req.params;
    const userId = req.user._id.toString();
    const updateData = req.body;

    // Additional check for valid ObjectId format
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid character ID format",
      });
    }

    const character = await characterService.updateCharacter(
      id,
      userId,
      updateData
    );

    if (!character) {
      return res.status(404).json({
        success: false,
        message: "Character not found",
      });
    }

    res.json({
      success: true,
      message: "Character updated successfully",
      data: { character },
    });
  } catch (error) {
    logger.error(`Update character error: ${error.message}`);

    // Handle specific MongoDB errors
    if (error.name === "CastError" && error.kind === "ObjectId") {
      return res.status(400).json({
        success: false,
        message: "Invalid character ID format",
      });
    }

    // Handle validation errors
    if (error.name === "ValidationError") {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: Object.values(error.errors).map((err) => ({
          field: err.path,
          message: err.message,
        })),
      });
    }

    res.status(500).json({
      success: false,
      message: "Failed to update character",
    });
  }
};

/**
 * Delete a character
 */
const deleteCharacter = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user._id.toString();

    // Check if character is used in any books
    const usedInBooks = await characterService.getCharacterUsageInBooks(id);

    if (usedInBooks.length > 0) {
      return res.status(409).json({
        success: false,
        message: "Character is used in books and cannot be deleted",
        data: { usedInBooks },
      });
    }

    const deleted = await characterService.deleteCharacter(id, userId);

    if (!deleted) {
      return res.status(404).json({
        success: false,
        message: "Character not found",
      });
    }

    res.json({
      success: true,
      message: "Character deleted successfully",
    });
  } catch (error) {
    logger.error(`Delete character error: ${error.message}`);
    res.status(500).json({
      success: false,
      message: "Failed to delete character",
    });
  }
};

/**
 * Force delete a character (even if used in books)
 */
const forceDeleteCharacter = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user._id.toString();

    const deleted = await characterService.deleteCharacter(id, userId);

    if (!deleted) {
      return res.status(404).json({
        success: false,
        message: "Character not found",
      });
    }

    res.json({
      success: true,
      message: "Character deleted successfully",
    });
  } catch (error) {
    logger.error(`Force delete character error: ${error.message}`);
    res.status(500).json({
      success: false,
      message: "Failed to delete character",
    });
  }
};

/**
 * Generate presigned URL for character reference image upload
 */
const generateImageUploadUrl = async (req, res) => {
  try {
    const { id } = req.params;
    const { contentType } = req.body;
    const userId = req.user._id.toString();

    // Verify character exists and belongs to user
    const character = await characterService.getCharacterById(id, userId);
    if (!character) {
      return res.status(404).json({
        success: false,
        message: "Character not found",
      });
    }

    // Reference images are now allowed for all character types

    logger.info(`Full character data:`, JSON.stringify(character, null, 2));

    logger.info(
      `Generating image upload URL for ${character.characterType} character: ${id}`
    );

    // Validate content type (reuse avatar validation)
    if (!contentType || !s3Service.isValidAvatarFileType(contentType)) {
      return res.status(400).json({
        success: false,
        message: "Invalid file type. Only JPG and PNG files are allowed.",
      });
    }

    // Generate S3 key for the character image
    const fileExtension =
      s3Service.getFileExtensionFromContentType(contentType);
    const s3Key = s3Service.generateCharacterImageS3Key(
      userId,
      id,
      fileExtension
    );

    // Generate presigned URL (15 minutes expiration)
    const presignedUrl = await s3Service.generatePresignedUploadUrl(
      s3Key,
      contentType,
      900 // 15 minutes
    );

    // Generate the CloudFront URL that will be used after upload
    const cloudFrontUrl = s3Service.generateCloudFrontUrl(s3Key);

    logger.info(`Generated character image upload URL for character ${id}`);

    res.json({
      success: true,
      data: {
        uploadUrl: presignedUrl,
        imageUrl: cloudFrontUrl,
        s3Key: s3Key,
      },
    });
  } catch (error) {
    logger.error(`Generate character image upload URL error: ${error.message}`);
    res.status(500).json({
      success: false,
      message: "Failed to generate upload URL",
    });
  }
};

/**
 * Update character's reference image URL after successful upload
 */
const updateCharacterImage = async (req, res) => {
  try {
    const { id } = req.params;
    const { imageUrl } = req.body;
    const userId = req.user._id.toString();

    // Validate image URL
    if (!imageUrl || typeof imageUrl !== "string") {
      return res.status(400).json({
        success: false,
        message: "Image URL is required",
      });
    }

    // Verify character exists and belongs to user
    const character = await characterService.getCharacterById(id, userId);
    if (!character) {
      return res.status(404).json({
        success: false,
        message: "Character not found",
      });
    }

    // Reference images are now allowed for all character types

    logger.info(
      `Updating reference image for ${character.characterType} character: ${id}`
    );

    // Delete old image if it exists (field is transformed to camelCase by toJSON)
    if (character.referenceImageUrl) {
      try {
        const oldS3Key = s3Service.extractS3KeyFromCloudFrontUrl(
          character.referenceImageUrl
        );
        if (oldS3Key) {
          await s3Service.deleteFile(oldS3Key);
          logger.info(
            `Deleted old reference image for character ${id}: ${oldS3Key}`
          );
        }
      } catch (deleteError) {
        logger.error(
          `Failed to delete old reference image: ${deleteError.message}`
        );
        // Don't fail the update if old file deletion fails
      }
    }

    // Update character's reference image URL
    const updatedCharacter = await characterService.updateCharacter(
      id,
      userId,
      { reference_image_url: imageUrl }
    );

    if (!updatedCharacter) {
      return res.status(404).json({
        success: false,
        message: "Character not found",
      });
    }

    logger.info(`Updated reference image for character ${id}`);

    res.json({
      success: true,
      message: "Character image updated successfully",
      data: { character: updatedCharacter },
    });
  } catch (error) {
    logger.error(`Update character image error: ${error.message}`);
    res.status(500).json({
      success: false,
      message: "Failed to update character image",
    });
  }
};

/**
 * Delete character's reference image
 */
const deleteCharacterImage = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user._id.toString();

    // Verify character exists and belongs to user
    const character = await characterService.getCharacterById(id, userId);
    if (!character) {
      return res.status(404).json({
        success: false,
        message: "Character not found",
      });
    }

    // Reference images are now allowed for all character types

    // Check if character has a reference image (field is transformed to camelCase by toJSON)
    if (!character.referenceImageUrl) {
      return res.status(400).json({
        success: false,
        message: "Character has no reference image to delete",
      });
    }

    // Delete image from S3
    try {
      const s3Key = s3Service.extractS3KeyFromCloudFrontUrl(
        character.referenceImageUrl
      );
      if (s3Key) {
        await s3Service.deleteFile(s3Key);
        logger.info(`Deleted reference image for character ${id}: ${s3Key}`);
      }
    } catch (deleteError) {
      logger.error(
        `Failed to delete reference image from S3: ${deleteError.message}`
      );
      return res.status(500).json({
        success: false,
        message: "Failed to delete image from storage",
      });
    }

    // Update character to remove image URL
    const updatedCharacter = await characterService.updateCharacter(
      id,
      userId,
      { reference_image_url: null }
    );

    res.json({
      success: true,
      message: "Character image deleted successfully",
      data: { character: updatedCharacter },
    });
  } catch (error) {
    logger.error(`Delete character image error: ${error.message}`);
    res.status(500).json({
      success: false,
      message: "Failed to delete character image",
    });
  }
};

module.exports = {
  getCharacters,
  getCharacterById,
  createCharacter,
  updateCharacter,
  deleteCharacter,
  forceDeleteCharacter,
  generateImageUploadUrl,
  updateCharacterImage,
  deleteCharacterImage,
};
