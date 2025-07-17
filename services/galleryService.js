const mongoose = require("mongoose");
const { Book } = require("../models");
const logger = require("../utils/logger");

class GalleryService {
  /**
   * Get public books for gallery with pagination and search
   * @param {Object} options - Query options
   * @returns {Promise<Object>} - Public books and pagination info
   */
  async getPublicBooks(options = {}) {
    try {
      const {
        page = 1,
        limit = 12,
        search = "",
        sortBy = "created_at",
        sortOrder = "desc",
      } = options;

      const skip = (page - 1) * limit;

      // Build query for public completed books
      const query = {
        is_public: true,
        generation_status: "completed",
      };

      // Add search functionality
      if (search && search.trim()) {
        query.$or = [
          { title: { $regex: search.trim(), $options: "i" } },
          { description: { $regex: search.trim(), $options: "i" } },
        ];
      }

      // Build sort object
      const sort = {};
      sort[sortBy] = sortOrder === "desc" ? -1 : 1;

      const [books, totalCount] = await Promise.all([
        Book.find(query)
          .populate("character_ids", "character_name character_type")
          .populate("user_id", "first_name last_name")
          .sort(sort)
          .skip(skip)
          .limit(limit),
        Book.countDocuments(query),
      ]);

      const totalPages = Math.ceil(totalCount / limit);
      const hasNextPage = page < totalPages;

      return {
        books,
        pagination: {
          currentPage: page,
          totalPages,
          totalCount,
          hasNextPage,
          limit,
        },
      };
    } catch (error) {
      logger.error("Failed to get public books:", error);
      throw error;
    }
  }

  /**
   * Get a public book for template usage
   * @param {string} bookId - Book ID
   * @returns {Promise<Object>} - Book template data
   */
  async getBookForTemplate(bookId) {
    try {
      if (!mongoose.Types.ObjectId.isValid(bookId)) {
        throw new Error("Invalid book ID format");
      }

      const book = await Book.findOne({
        _id: bookId,
        is_public: true,
        generation_status: "completed",
      })
        .populate("character_ids")
        .populate("user_id", "first_name last_name");

      if (!book) {
        throw new Error("Public book not found");
      }

      // Convert book and characters to JSON to apply field transformations
      const bookJson = book.toJSON();

      // Return template data (excluding generated content URLs and IDs)
      const templateData = {
        title: bookJson.title,
        description: bookJson.description,
        dedication: bookJson.dedication,
        moral: bookJson.moral,
        language: bookJson.language,
        pageCount: bookJson.pageCount,
        illustrationStyle: bookJson.illustrationStyle,
        characters: bookJson.characterIds.map((character) => ({
          characterName: character.characterName,
          characterType: character.characterType,
          // Include character details for reference
          age: character.age,
          gender: character.gender,
          ethnicity: character.ethnicity,
          hairColor: character.hairColor,
          eyeColor: character.eyeColor,
          petType: character.petType,
          breed: character.breed,
          fur: character.fur,
          ears: character.ears,
          tail: character.tail,
          personality: character.personality,
          referenceImageUrl: character.referenceImageUrl,
        })),
        originalBook: {
          id: bookJson.id,
          title: bookJson.title,
          author: `${bookJson.userId.firstName} ${bookJson.userId.lastName}`,
          createdAt: bookJson.createdAt,
        },
      };

      return templateData;
    } catch (error) {
      logger.error(`Failed to get book template ${bookId}:`, error);
      throw error;
    }
  }

  /**
   * Get featured public books (most recent or popular)
   * @param {number} limit - Number of books to return
   * @returns {Promise<Array>} - Featured books
   */
  async getFeaturedBooks(limit = 6) {
    try {
      const books = await Book.find({
        is_public: true,
        generation_status: "completed",
      })
        .populate("character_ids", "character_name character_type")
        .populate("user_id", "first_name last_name")
        .sort({ created_at: -1 })
        .limit(limit);

      return books;
    } catch (error) {
      logger.error("Failed to get featured books:", error);
      throw error;
    }
  }

  /**
   * Get public books by language
   * @param {string} language - Language code
   * @param {Object} options - Query options
   * @returns {Promise<Object>} - Books and pagination info
   */
  async getPublicBooksByLanguage(language, options = {}) {
    try {
      const {
        page = 1,
        limit = 12,
        sortBy = "created_at",
        sortOrder = "desc",
      } = options;

      const skip = (page - 1) * limit;

      const query = {
        is_public: true,
        generation_status: "completed",
        language: language,
      };

      // Build sort object
      const sort = {};
      sort[sortBy] = sortOrder === "desc" ? -1 : 1;

      const [books, totalCount] = await Promise.all([
        Book.find(query)
          .populate("character_ids", "character_name character_type")
          .populate("user_id", "first_name last_name")
          .sort(sort)
          .skip(skip)
          .limit(limit),
        Book.countDocuments(query),
      ]);

      const totalPages = Math.ceil(totalCount / limit);
      const hasNextPage = page < totalPages;

      return {
        books,
        pagination: {
          currentPage: page,
          totalPages,
          totalCount,
          hasNextPage,
          limit,
        },
      };
    } catch (error) {
      logger.error(
        `Failed to get public books by language ${language}:`,
        error
      );
      throw error;
    }
  }

  /**
   * Get gallery statistics
   * @returns {Promise<Object>} - Gallery statistics
   */
  async getGalleryStats() {
    try {
      const [totalPublicBooks, totalLanguages, totalAuthors, recentBooksCount] =
        await Promise.all([
          Book.countDocuments({
            is_public: true,
            generation_status: "completed",
          }),
          Book.distinct("language", {
            is_public: true,
            generation_status: "completed",
          }),
          Book.distinct("user_id", {
            is_public: true,
            generation_status: "completed",
          }),
          Book.countDocuments({
            is_public: true,
            generation_status: "completed",
            created_at: {
              $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // Last 30 days
            },
          }),
        ]);

      return {
        totalPublicBooks,
        totalLanguages: totalLanguages.length,
        totalAuthors: totalAuthors.length,
        recentBooksCount,
      };
    } catch (error) {
      logger.error("Failed to get gallery statistics:", error);
      throw error;
    }
  }
}

module.exports = GalleryService;
