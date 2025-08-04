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
        searchType = "all", // 'all', 'title_description', 'user'
        sortBy = "created_at",
        sortOrder = "desc",
      } = options;

      const skip = (page - 1) * limit;

      // Build query for public completed books
      const query = {
        is_public: true,
        generation_status: "completed",
      };

      // Build sort object
      const sort = {};
      sort[sortBy] = sortOrder === "desc" ? -1 : 1;

      let books, totalCount;

      // Add search functionality
      if (search && search.trim()) {
        const searchTerm = search.trim();
        const searchRegex = { $regex: searchTerm, $options: "i" };

        if (searchType === "user") {
          // Use aggregation for user search
          const pipeline = [
            {
              $lookup: {
                from: "users",
                localField: "user_id",
                foreignField: "_id",
                as: "user",
              },
            },
            {
              $match: {
                ...query,
                $or: [
                  { "user.first_name": searchRegex },
                  { "user.last_name": searchRegex },
                ],
              },
            },
            { $sort: sort },
            { $skip: skip },
            { $limit: limit },
            {
              $lookup: {
                from: "characters",
                localField: "character_ids",
                foreignField: "_id",
                as: "character_ids",
                pipeline: [
                  { $project: { character_name: 1, character_type: 1 } },
                ],
              },
            },
            {
              $addFields: {
                // Transform to match frontend expectations (camelCase)
                id: "$_id",
                userId: {
                  $let: {
                    vars: { userObj: { $arrayElemAt: ["$user", 0] } },
                    in: {
                      _id: "$$userObj._id",
                      id: "$$userObj._id",
                      firstName: "$$userObj.first_name",
                      lastName: "$$userObj.last_name",
                    },
                  },
                },
                characterIds: "$character_ids",
                pageCount: "$page_count",
                illustrationStyle: "$illustration_style",
                generationStatus: "$generation_status",
                isPublic: "$is_public",
                frontCoverImageUrl: "$front_cover_image_url",
                backCoverImageUrl: "$back_cover_image_url",
                createdAt: "$created_at",
                updatedAt: "$updated_at",
              },
            },
            {
              $project: {
                user: 0,
                _id: 0,
                user_id: 0,
                character_ids: 0,
                page_count: 0,
                illustration_style: 0,
                generation_status: 0,
                is_public: 0,
                front_cover_image_url: 0,
                back_cover_image_url: 0,
                created_at: 0,
                updated_at: 0,
                __v: 0,
              },
            },
          ];

          const countPipeline = [
            {
              $lookup: {
                from: "users",
                localField: "user_id",
                foreignField: "_id",
                as: "user",
              },
            },
            {
              $match: {
                ...query,
                $or: [
                  { "user.first_name": searchRegex },
                  { "user.last_name": searchRegex },
                ],
              },
            },
            { $count: "total" },
          ];

          const [booksResult, totalCountResult] = await Promise.all([
            Book.aggregate(pipeline),
            Book.aggregate(countPipeline),
          ]);

          books = booksResult;
          totalCount = totalCountResult[0]?.total || 0;
        } else {
          // Use regular find for title/description search
          if (searchType === "title_description") {
            query.$or = [{ title: searchRegex }, { description: searchRegex }];
          } else {
            // Search in all fields (default) - use aggregation for user fields
            const pipeline = [
              {
                $lookup: {
                  from: "users",
                  localField: "user_id",
                  foreignField: "_id",
                  as: "user",
                },
              },
              {
                $match: {
                  ...query,
                  $or: [
                    { title: searchRegex },
                    { description: searchRegex },
                    { "user.first_name": searchRegex },
                    { "user.last_name": searchRegex },
                  ],
                },
              },
              { $sort: sort },
              { $skip: skip },
              { $limit: limit },
              {
                $lookup: {
                  from: "characters",
                  localField: "character_ids",
                  foreignField: "_id",
                  as: "character_ids",
                  pipeline: [
                    { $project: { character_name: 1, character_type: 1 } },
                  ],
                },
              },
              {
                $addFields: {
                  // Transform to match frontend expectations (camelCase)
                  id: "$_id",
                  userId: {
                    $let: {
                      vars: { userObj: { $arrayElemAt: ["$user", 0] } },
                      in: {
                        _id: "$$userObj._id",
                        id: "$$userObj._id",
                        firstName: "$$userObj.first_name",
                        lastName: "$$userObj.last_name",
                      },
                    },
                  },
                  characterIds: "$character_ids",
                  pageCount: "$page_count",
                  illustrationStyle: "$illustration_style",
                  generationStatus: "$generation_status",
                  isPublic: "$is_public",
                  frontCoverImageUrl: "$front_cover_image_url",
                  backCoverImageUrl: "$back_cover_image_url",
                  createdAt: "$created_at",
                  updatedAt: "$updated_at",
                },
              },
              {
                $project: {
                  user: 0,
                  _id: 0,
                  user_id: 0,
                  character_ids: 0,
                  page_count: 0,
                  illustration_style: 0,
                  generation_status: 0,
                  is_public: 0,
                  front_cover_image_url: 0,
                  back_cover_image_url: 0,
                  created_at: 0,
                  updated_at: 0,
                  __v: 0,
                },
              },
            ];

            const countPipeline = [
              {
                $lookup: {
                  from: "users",
                  localField: "user_id",
                  foreignField: "_id",
                  as: "user",
                },
              },
              {
                $match: {
                  ...query,
                  $or: [
                    { title: searchRegex },
                    { description: searchRegex },
                    { "user.first_name": searchRegex },
                    { "user.last_name": searchRegex },
                  ],
                },
              },
              { $count: "total" },
            ];

            const [booksResult2, totalCountResult2] = await Promise.all([
              Book.aggregate(pipeline),
              Book.aggregate(countPipeline),
            ]);

            books = booksResult2;
            totalCount = totalCountResult2[0]?.total || 0;
          }

          if (searchType === "title_description") {
            const [booksResult3, totalCountResult3] = await Promise.all([
              Book.find(query)
                .populate("character_ids", "character_name character_type")
                .populate("user_id", "first_name last_name")
                .sort(sort)
                .skip(skip)
                .limit(limit),
              Book.countDocuments(query),
            ]);
            // Transform to JSON to apply model transformations
            books = booksResult3.map((book) => book.toJSON());
            totalCount = totalCountResult3;
          }
        }
      } else {
        // No search - use regular find
        const [booksResult4, totalCountResult4] = await Promise.all([
          Book.find(query)
            .populate("character_ids", "character_name character_type")
            .populate("user_id", "first_name last_name")
            .sort(sort)
            .skip(skip)
            .limit(limit),
          Book.countDocuments(query),
        ]);
        // Transform to JSON to apply model transformations
        books = booksResult4.map((book) => book.toJSON());
        totalCount = totalCountResult4;
      }

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
   * Get a book for template usage (public books or user's own books)
   * @param {string} bookId - Book ID
   * @param {string} userId - User ID (optional)
   * @returns {Promise<Object>} - Book template data
   */
  async getBookForTemplate(bookId, userId = null) {
    try {
      if (!mongoose.Types.ObjectId.isValid(bookId)) {
        throw new Error("Invalid book ID format");
      }

      // Build query to find either public books or user's own books
      const query = {
        _id: bookId,
        generation_status: "completed",
      };

      // If user is authenticated, allow access to their own books or public books
      if (userId) {
        query.$or = [{ is_public: true }, { user_id: userId }];
      } else {
        // If not authenticated, only allow public books
        query.is_public = true;
      }

      const book = await Book.findOne(query)
        .populate("character_ids")
        .populate("user_id", "first_name last_name");

      if (!book) {
        throw new Error("Book not found or access denied");
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
