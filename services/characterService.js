const mongoose = require("mongoose");
const { Character, User } = require("../models");
const s3Service = require("./s3Service");
const logger = require("../utils/logger");

/**
 * Get characters for a user with pagination
 * @param {string} userId - User's MongoDB ID
 * @param {number} page - Page number (1-based)
 * @param {number} limit - Number of characters per page
 * @param {string} type - Filter by character type ('human', 'pet', or null for all)
 * @returns {Promise<Object>} - Paginated characters result
 */
const getUserCharacters = async (userId, page = 1, limit = 12, type = null) => {
  try {
    const skip = (page - 1) * limit;

    // Build query
    const query = { user_id: new mongoose.Types.ObjectId(userId) };
    if (type && ["human", "pet"].includes(type)) {
      query.character_type = type;
    }

    // Get characters with pagination (without lean() to enable toJSON transformation)
    const charactersRaw = await Character.find(query)
      .sort({ created_at: -1 }) // Most recent first
      .skip(skip)
      .limit(limit);

    // Transform characters using toJSON to get proper field names
    const characters = charactersRaw.map((character) => character.toJSON());

    // Get total count for pagination
    const totalCount = await Character.countDocuments(query);
    const totalPages = Math.ceil(totalCount / limit);
    const hasNextPage = page < totalPages;
    const hasPreviousPage = page > 1;

    logger.info(
      `Retrieved ${characters.length} characters for user ${userId}, page ${page}`
    );

    return {
      characters,
      pagination: {
        currentPage: page,
        totalPages,
        totalCount,
        hasNextPage,
        hasPreviousPage,
        limit,
      },
    };
  } catch (error) {
    logger.error(`Error getting user characters: ${error.message}`);
    throw error;
  }
};

/**
 * Get a specific character by ID
 * @param {string} characterId - Character's MongoDB ID
 * @param {string} userId - User's MongoDB ID (for ownership verification)
 * @returns {Promise<Object|null>} - Character object or null if not found
 */
const getCharacterById = async (characterId, userId) => {
  try {
    console.log("getCharacterById", characterId, userId);
    const character = await Character.findOne({
      _id: new mongoose.Types.ObjectId(characterId),
      user_id: new mongoose.Types.ObjectId(userId),
    });

    if (character) {
      logger.info(`Retrieved character ${characterId} for user ${userId}`);
      return character.toJSON(); // Transform to get proper field names
    } else {
      logger.warn(`Character ${characterId} not found for user ${userId}`);
      return null;
    }
  } catch (error) {
    logger.error(`Error getting character by ID: ${error.message}`);
    throw error;
  }
};

/**
 * Create a new character
 * @param {string} userId - User's MongoDB ID
 * @param {Object} characterData - Character data
 * @returns {Promise<Object>} - Created character
 */
const createCharacter = async (userId, characterData) => {
  try {
    // Validate required fields based on character type
    if (characterData.character_type === "human") {
      if (!characterData.age || !characterData.gender) {
        throw new Error("Age and gender are required for human characters");
      }
    }

    // Create character
    const character = new Character({
      user_id: new mongoose.Types.ObjectId(userId),
      ...characterData,
    });

    const savedCharacter = await character.save();
    logger.info(
      `Created character ${savedCharacter._id} for user ${userId} with type: ${savedCharacter.character_type}`
    );

    return savedCharacter.toJSON();
  } catch (error) {
    logger.error(`Error creating character: ${error.message}`);
    throw error;
  }
};

/**
 * Update a character
 * @param {string} characterId - Character's MongoDB ID
 * @param {string} userId - User's MongoDB ID (for ownership verification)
 * @param {Object} updateData - Data to update
 * @returns {Promise<Object|null>} - Updated character or null if not found
 */
const updateCharacter = async (characterId, userId, updateData) => {
  try {
    // Find the character first to verify ownership
    const existingCharacter = await Character.findOne({
      _id: new mongoose.Types.ObjectId(characterId),
      user_id: new mongoose.Types.ObjectId(userId),
    });

    if (!existingCharacter) {
      return null;
    }

    // Validate type-specific fields if character_type is being changed
    if (
      updateData.character_type &&
      updateData.character_type !== existingCharacter.character_type
    ) {
      if (updateData.character_type === "human") {
        if (!updateData.age || !updateData.gender) {
          throw new Error("Age and gender are required for human characters");
        }
      }
    }

    // Update character
    const updatedCharacter = await Character.findByIdAndUpdate(
      new mongoose.Types.ObjectId(characterId),
      updateData,
      { new: true, runValidators: true }
    );

    logger.info(`Updated character ${characterId} for user ${userId}`);

    return updatedCharacter.toJSON();
  } catch (error) {
    logger.error(`Error updating character: ${error.message}`);
    throw error;
  }
};

/**
 * Delete a character and its associated files
 * @param {string} characterId - Character's MongoDB ID
 * @param {string} userId - User's MongoDB ID (for ownership verification)
 * @returns {Promise<boolean>} - Success status
 */
const deleteCharacter = async (characterId, userId) => {
  try {
    // Find the character first to verify ownership and get image URL
    const character = await Character.findOne({
      _id: new mongoose.Types.ObjectId(characterId),
      user_id: new mongoose.Types.ObjectId(userId),
    });

    if (!character) {
      return false;
    }

    // Delete reference image from S3 if it exists
    if (character.reference_image_url) {
      try {
        const s3Key = s3Service.extractS3KeyFromCloudFrontUrl(
          character.reference_image_url
        );
        if (s3Key) {
          await s3Service.deleteFile(s3Key);
          logger.info(
            `Deleted reference image for character ${characterId}: ${s3Key}`
          );
        }
      } catch (deleteError) {
        logger.error(
          `Failed to delete reference image for character ${characterId}: ${deleteError.message}`
        );
        // Don't fail the character deletion if image deletion fails
      }
    }

    // Delete the character
    await Character.findByIdAndDelete(new mongoose.Types.ObjectId(characterId));
    logger.info(`Deleted character ${characterId} for user ${userId}`);

    return true;
  } catch (error) {
    logger.error(`Error deleting character: ${error.message}`);
    throw error;
  }
};

/**
 * Check if a character is used in any books
 * @param {string} characterId - Character's MongoDB ID
 * @returns {Promise<Array>} - Array of book titles where character is used
 */
const getCharacterUsageInBooks = async (characterId) => {
  try {
    // TODO: Implement this when Book model is available
    // For now, return empty array
    // const books = await Book.find({ character_ids: characterId }).select('title');
    // return books.map(book => book.title);

    logger.info(
      `Checked character usage for ${characterId} (not implemented yet)`
    );
    return [];
  } catch (error) {
    logger.error(`Error checking character usage: ${error.message}`);
    throw error;
  }
};

/**
 * Generate character reference image S3 key
 * @param {string} userId - User's MongoDB ID
 * @param {string} characterId - Character's MongoDB ID
 * @param {string} fileExtension - File extension (jpg, png)
 * @returns {string} - S3 key for character reference image
 */
const generateCharacterImageS3Key = (userId, characterId, fileExtension) => {
  return `${userId}/characters/${characterId}.${fileExtension}`;
};

module.exports = {
  getUserCharacters,
  getCharacterById,
  createCharacter,
  updateCharacter,
  deleteCharacter,
  getCharacterUsageInBooks,
  generateCharacterImageS3Key,
};
