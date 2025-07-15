const mongoose = require("mongoose");
const { Book, Page, Character } = require("../models");
const s3Service = require("./s3Service");
const LambdaService = require("./lambdaService");
const creditService = require("./creditService");
const logger = require("../utils/logger");

class BookService {
  constructor() {
    this.lambdaService = new LambdaService();
  }

  /**
   * Create a new book and trigger generation
   * @param {string} userId - User ID
   * @param {Object} bookData - Book creation data
   * @param {number} requiredCredits - Credits required for generation
   * @returns {Promise<Object>} - Created book
   */
  async createBook(userId, bookData, requiredCredits) {
    try {
      // Validate that all characters belong to the user
      const characterIds = bookData.character_ids || bookData.characterIds;
      if (!characterIds || characterIds.length === 0) {
        throw new Error("At least one character is required");
      }

      const characters = await Character.find({
        _id: { $in: characterIds },
        user_id: userId,
      });

      if (characters.length !== characterIds.length) {
        throw new Error(
          "One or more characters not found or not owned by user"
        );
      }

      // Create book document
      const book = new Book({
        user_id: userId,
        title: bookData.title,
        description: bookData.description,
        dedication: bookData.dedication || null,
        moral: bookData.moral,
        language: bookData.language,
        page_count: bookData.page_count || bookData.pageCount,
        illustration_style:
          bookData.illustration_style || bookData.illustrationStyle,
        character_ids: characterIds,
        generation_status: "pending",
      });

      const savedBook = await book.save();
      logger.info(`Book created successfully: ${savedBook._id}`);

      // Trigger Lambda function for book generation
      try {
        await this.lambdaService.invokeBookGenerationWithRetry(
          savedBook._id.toString()
        );

        // Deduct credits after successful Lambda invocation
        await creditService.deductCredits(
          userId,
          requiredCredits,
          `Book generation started for "${savedBook.title}" (${savedBook.page_count} pages)`,
          { bookId: savedBook._id }
        );

        // Update status to generating
        await Book.findByIdAndUpdate(savedBook._id, {
          generation_status: "generating",
        });

        logger.info(
          `Lambda invocation successful for book: ${savedBook._id}, ${requiredCredits} credits deducted`
        );
      } catch (lambdaError) {
        // Update status to failed if Lambda invocation fails
        await Book.findByIdAndUpdate(savedBook._id, {
          generation_status: "failed",
        });
        logger.error(
          `Lambda invocation failed for book: ${savedBook._id}`,
          lambdaError
        );
        // Don't throw error here - book is created but generation failed
        // No credits are deducted since generation didn't start
      }

      return savedBook;
    } catch (error) {
      logger.error("Book creation failed:", error);
      throw error;
    }
  }

  /**
   * Get user's books with pagination
   * @param {string} userId - User ID
   * @param {Object} options - Query options
   * @returns {Promise<Object>} - Books and pagination info
   */
  async getUserBooks(userId, options = {}) {
    try {
      const {
        page = 1,
        limit = 12,
        status = null,
        sortBy = "created_at",
        sortOrder = "desc",
      } = options;

      const skip = (page - 1) * limit;
      const query = { user_id: userId };

      // Add status filter if provided
      if (status) {
        query.generation_status = status;
      }

      // Build sort object
      const sort = {};
      sort[sortBy] = sortOrder === "desc" ? -1 : 1;

      const [books, totalCount] = await Promise.all([
        Book.find(query)
          .populate("character_ids", "character_name character_type")
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
      logger.error("Failed to get user books:", error);
      throw error;
    }
  }

  /**
   * Get book by ID with ownership check
   * @param {string} bookId - Book ID
   * @param {string} userId - User ID (optional for public books)
   * @returns {Promise<Object>} - Book with pages
   */
  async getBookById(bookId, userId = null) {
    try {
      if (!mongoose.Types.ObjectId.isValid(bookId)) {
        throw new Error("Invalid book ID format");
      }

      const book = await Book.findById(bookId)
        .populate("character_ids")
        .populate("user_id", "first_name last_name");

      if (!book) {
        throw new Error("Book not found");
      }

      // Check access permissions (handle both populated and non-populated user_id)
      const bookUserId = book.user_id._id
        ? book.user_id._id.toString()
        : book.user_id.toString();
      const isOwner = userId && bookUserId === userId;
      const isPublic = book.is_public;

      if (!isOwner && !isPublic) {
        throw new Error("Access denied");
      }

      // Get book pages
      const pages = await Page.find({ book_id: bookId }).sort({
        book_page_number: 1,
      });

      // Convert book to JSON to apply field transformations
      const bookJson = book.toJSON();

      // Also ensure pages are properly transformed
      const pagesJson = pages.map((page) =>
        page.toJSON ? page.toJSON() : page
      );

      return {
        ...bookJson,
        pages: pagesJson,
        isOwner,
      };
    } catch (error) {
      logger.error(`Failed to get book ${bookId}:`, error);
      throw error;
    }
  }

  /**
   * Update book metadata
   * @param {string} bookId - Book ID
   * @param {string} userId - User ID
   * @param {Object} updateData - Update data
   * @returns {Promise<Object>} - Updated book
   */
  async updateBook(bookId, userId, updateData) {
    try {
      if (!mongoose.Types.ObjectId.isValid(bookId)) {
        throw new Error("Invalid book ID format");
      }

      const book = await Book.findOne({ _id: bookId, user_id: userId });
      if (!book) {
        throw new Error("Book not found or access denied");
      }

      // Only allow updating certain fields
      const allowedFields = [
        "title",
        "description",
        "dedication",
        "moral",
        "moral_of_back_cover",
        "front_cover_image_url",
        "back_cover_image_url",
      ];

      const filteredUpdate = {};
      let pdfContentChanged = false;

      // Fields that affect PDF content
      const pdfAffectingFields = [
        "title",
        "dedication",
        "moral_of_back_cover",
        "front_cover_image_url",
        "back_cover_image_url",
      ];

      Object.keys(updateData).forEach((key) => {
        if (allowedFields.includes(key)) {
          // Special validation for cover URLs
          if (
            key === "front_cover_image_url" ||
            key === "back_cover_image_url"
          ) {
            const coverType =
              key === "front_cover_image_url" ? "front" : "back";
            const alternativesField = `alternative_${coverType}_covers`;
            const alternatives = book[alternativesField] || [];

            // Validate that the selected URL is in the alternatives array
            if (updateData[key] && !alternatives.includes(updateData[key])) {
              throw new Error(
                `Selected ${coverType} cover URL is not in the available alternatives`
              );
            }
          }

          // Check if this field affects PDF content
          if (
            pdfAffectingFields.includes(key) &&
            updateData[key] !== book[key]
          ) {
            pdfContentChanged = true;
          }

          filteredUpdate[key] = updateData[key];
        }
      });

      // Set PDF regeneration flag if content that affects PDF was changed
      if (pdfContentChanged && book.generation_status === "completed") {
        filteredUpdate.pdf_needs_regeneration = true;
        logger.info(
          `PDF regeneration flag set for book ${bookId} due to content changes`
        );
      }

      const updatedBook = await Book.findByIdAndUpdate(bookId, filteredUpdate, {
        new: true,
        runValidators: true,
      }).populate("character_ids");

      logger.info(`Book updated successfully: ${bookId}`);
      return updatedBook;
    } catch (error) {
      logger.error(`Failed to update book ${bookId}:`, error);
      throw error;
    }
  }

  /**
   * Toggle book public/private status
   * @param {string} bookId - Book ID
   * @param {string} userId - User ID
   * @returns {Promise<Object>} - Updated book
   */
  async toggleBookPublic(bookId, userId) {
    try {
      if (!mongoose.Types.ObjectId.isValid(bookId)) {
        throw new Error("Invalid book ID format");
      }

      const book = await Book.findOne({ _id: bookId, user_id: userId });
      if (!book) {
        throw new Error("Book not found or access denied");
      }

      // Only allow toggling for completed books
      if (book.generation_status !== "completed") {
        throw new Error("Only completed books can be made public");
      }

      const updatedBook = await Book.findByIdAndUpdate(
        bookId,
        { is_public: !book.is_public },
        { new: true }
      );

      logger.info(
        `Book ${bookId} public status toggled to: ${updatedBook.is_public}`
      );
      return updatedBook;
    } catch (error) {
      logger.error(`Failed to toggle book public status ${bookId}:`, error);
      throw error;
    }
  }

  /**
   * Delete book and cleanup associated resources
   * @param {string} bookId - Book ID
   * @param {string} userId - User ID
   * @returns {Promise<void>}
   */
  async deleteBook(bookId, userId) {
    try {
      if (!mongoose.Types.ObjectId.isValid(bookId)) {
        throw new Error("Invalid book ID format");
      }

      const book = await Book.findOne({ _id: bookId, user_id: userId });
      if (!book) {
        throw new Error("Book not found or access denied");
      }

      // Get all pages for S3 cleanup
      const pages = await Page.find({ book_id: bookId });

      // Collect all S3 URLs for deletion
      const s3UrlsToDelete = [];

      // Add book cover URLs
      if (book.front_cover_image_url) {
        s3UrlsToDelete.push(book.front_cover_image_url);
      }
      if (book.back_cover_image_url) {
        s3UrlsToDelete.push(book.back_cover_image_url);
      }
      if (book.alternative_front_covers) {
        s3UrlsToDelete.push(...book.alternative_front_covers);
      }
      if (book.alternative_back_covers) {
        s3UrlsToDelete.push(...book.alternative_back_covers);
      }
      if (book.pdf_url) {
        s3UrlsToDelete.push(book.pdf_url);
      }

      // Add page illustration URLs
      pages.forEach((page) => {
        if (page.illustration_url) {
          s3UrlsToDelete.push(page.illustration_url);
        }
        if (page.alternative_illustrations) {
          s3UrlsToDelete.push(...page.alternative_illustrations);
        }
      });

      // Delete from database first
      await Promise.all([
        Book.findByIdAndDelete(bookId),
        Page.deleteMany({ book_id: bookId }),
      ]);

      logger.info(
        `Book ${bookId} and ${pages.length} pages deleted from database`
      );

      // Clean up S3 assets (continue on failures, just log them)
      if (s3UrlsToDelete.length > 0) {
        await this.cleanupS3Assets(s3UrlsToDelete);
      }

      logger.info(`Book deletion completed: ${bookId}`);
    } catch (error) {
      logger.error(`Failed to delete book ${bookId}:`, error);
      throw error;
    }
  }

  /**
   * Clean up S3 assets
   * @param {Array} s3Urls - Array of S3 URLs to delete
   */
  async cleanupS3Assets(s3Urls) {
    for (const url of s3Urls) {
      try {
        // Extract S3 key from CloudFront URL
        const s3Key = s3Service.extractS3KeyFromCloudFrontUrl(url);
        if (s3Key) {
          await s3Service.deleteFile(s3Key);
          logger.info(`S3 asset deleted: ${url}`);
        } else {
          logger.warn(`Could not extract S3 key from URL: ${url}`);
        }
      } catch (error) {
        logger.warn(`Failed to delete S3 asset: ${url}`, error);
        // Continue with other deletions
      }
    }
  }

  /**
   * Retry failed book generation
   * @param {string} bookId - Book ID
   * @param {string} userId - User ID
   * @returns {Promise<Object>} - Updated book
   */
  async retryBookGeneration(bookId, userId) {
    try {
      if (!mongoose.Types.ObjectId.isValid(bookId)) {
        throw new Error("Invalid book ID format");
      }

      const book = await Book.findOne({ _id: bookId, user_id: userId });
      if (!book) {
        throw new Error("Book not found or access denied");
      }

      if (book.generation_status !== "failed") {
        throw new Error("Only failed books can be retried");
      }

      // Update status to pending
      await Book.findByIdAndUpdate(bookId, { generation_status: "pending" });

      // Trigger Lambda function
      try {
        await this.lambdaService.invokeBookGenerationWithRetry(bookId);

        // Update status to generating
        await Book.findByIdAndUpdate(bookId, {
          generation_status: "generating",
        });
        logger.info(`Book generation retry successful: ${bookId}`);
      } catch (lambdaError) {
        // Update status back to failed
        await Book.findByIdAndUpdate(bookId, { generation_status: "failed" });
        logger.error(`Book generation retry failed: ${bookId}`, lambdaError);
        throw new Error("Failed to retry book generation");
      }

      return await Book.findById(bookId);
    } catch (error) {
      logger.error(`Failed to retry book generation ${bookId}:`, error);
      throw error;
    }
  }
}

module.exports = BookService;
