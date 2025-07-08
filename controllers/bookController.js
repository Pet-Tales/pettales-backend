const { validationResult } = require("express-validator");
const mongoose = require("mongoose");
const BookService = require("../services/bookService");
const logger = require("../utils/logger");
// const { useErrorTranslation } = require("../utils/errorMapper");

const bookService = new BookService();

/**
 * Create a new book
 */
const createBook = async (req, res) => {
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
    const bookData = req.body;

    const book = await bookService.createBook(userId, bookData);

    res.status(201).json({
      success: true,
      message: "Book created successfully",
      data: { book },
    });
  } catch (error) {
    logger.error(`Create book error: ${error.message}`);

    // Handle specific errors
    if (error.message.includes("characters not found")) {
      return res.status(400).json({
        success: false,
        message: "One or more selected characters not found",
      });
    }

    if (error.message.includes("At least one character")) {
      return res.status(400).json({
        success: false,
        message: "At least one character is required",
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
      message: "Failed to create book",
    });
  }
};

/**
 * Get user's books with pagination
 */
const getUserBooks = async (req, res) => {
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
    const options = {
      page: parseInt(req.query.page) || 1,
      limit: parseInt(req.query.limit) || 12,
      status: req.query.status || null,
      sortBy: req.query.sortBy || "created_at",
      sortOrder: req.query.sortOrder || "desc",
    };

    const result = await bookService.getUserBooks(userId, options);

    res.json({
      success: true,
      message: "Books retrieved successfully",
      data: result,
    });
  } catch (error) {
    logger.error(`Get user books error: ${error.message}`);
    res.status(500).json({
      success: false,
      message: "Failed to retrieve books",
    });
  }
};

/**
 * Get book by ID
 */
const getBookById = async (req, res) => {
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

    const { id } = req.params;
    const userId = req.user ? req.user._id.toString() : null;

    // Additional check for valid ObjectId format
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid book ID format",
      });
    }

    const book = await bookService.getBookById(id, userId);

    res.json({
      success: true,
      message: "Book retrieved successfully",
      data: { book },
    });
  } catch (error) {
    logger.error(`Get book by ID error: ${error.message}`);

    // Handle specific errors
    if (error.message === "Book not found") {
      return res.status(404).json({
        success: false,
        message: "Book not found",
      });
    }

    if (error.message === "Access denied") {
      return res.status(403).json({
        success: false,
        message: "Access denied",
      });
    }

    if (error.message === "Invalid book ID format") {
      return res.status(400).json({
        success: false,
        message: "Invalid book ID format",
      });
    }

    res.status(500).json({
      success: false,
      message: "Failed to retrieve book",
    });
  }
};

/**
 * Update book metadata
 */
const updateBook = async (req, res) => {
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

    const { id } = req.params;
    const userId = req.user._id.toString();
    const updateData = req.body;

    // Additional check for valid ObjectId format
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid book ID format",
      });
    }

    const book = await bookService.updateBook(id, userId, updateData);

    res.json({
      success: true,
      message: "Book updated successfully",
      data: { book },
    });
  } catch (error) {
    logger.error(`Update book error: ${error.message}`);

    // Handle specific errors
    if (error.message === "Book not found or access denied") {
      return res.status(404).json({
        success: false,
        message: "Book not found",
      });
    }

    if (error.message === "Invalid book ID format") {
      return res.status(400).json({
        success: false,
        message: "Invalid book ID format",
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
      message: "Failed to update book",
    });
  }
};

/**
 * Toggle book public/private status
 */
const toggleBookPublic = async (req, res) => {
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

    const { id } = req.params;
    const userId = req.user._id.toString();

    // Additional check for valid ObjectId format
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid book ID format",
      });
    }

    const book = await bookService.toggleBookPublic(id, userId);

    res.json({
      success: true,
      message: `Book ${
        book.is_public ? "made public" : "made private"
      } successfully`,
      data: { book },
    });
  } catch (error) {
    logger.error(`Toggle book public error: ${error.message}`);

    // Handle specific errors
    if (error.message === "Book not found or access denied") {
      return res.status(404).json({
        success: false,
        message: "Book not found",
      });
    }

    if (error.message === "Only completed books can be made public") {
      return res.status(400).json({
        success: false,
        message: "Only completed books can be made public",
      });
    }

    if (error.message === "Invalid book ID format") {
      return res.status(400).json({
        success: false,
        message: "Invalid book ID format",
      });
    }

    res.status(500).json({
      success: false,
      message: "Failed to toggle book status",
    });
  }
};

/**
 * Delete book
 */
const deleteBook = async (req, res) => {
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

    const { id } = req.params;
    const userId = req.user._id.toString();

    // Additional check for valid ObjectId format
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid book ID format",
      });
    }

    await bookService.deleteBook(id, userId);

    res.json({
      success: true,
      message: "Book deleted successfully",
    });
  } catch (error) {
    logger.error(`Delete book error: ${error.message}`);

    // Handle specific errors
    if (error.message === "Book not found or access denied") {
      return res.status(404).json({
        success: false,
        message: "Book not found",
      });
    }

    if (error.message === "Invalid book ID format") {
      return res.status(400).json({
        success: false,
        message: "Invalid book ID format",
      });
    }

    res.status(500).json({
      success: false,
      message: "Failed to delete book",
    });
  }
};

/**
 * Retry failed book generation
 */
const retryBookGeneration = async (req, res) => {
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

    const { id } = req.params;
    const userId = req.user._id.toString();

    // Additional check for valid ObjectId format
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid book ID format",
      });
    }

    const book = await bookService.retryBookGeneration(id, userId);

    res.json({
      success: true,
      message: "Book generation retry initiated successfully",
      data: { book },
    });
  } catch (error) {
    logger.error(`Retry book generation error: ${error.message}`);

    // Handle specific errors
    if (error.message === "Book not found or access denied") {
      return res.status(404).json({
        success: false,
        message: "Book not found",
      });
    }

    if (error.message === "Only failed books can be retried") {
      return res.status(400).json({
        success: false,
        message: "Only failed books can be retried",
      });
    }

    if (error.message === "Failed to retry book generation") {
      return res.status(500).json({
        success: false,
        message: "Failed to retry book generation",
      });
    }

    if (error.message === "Invalid book ID format") {
      return res.status(400).json({
        success: false,
        message: "Invalid book ID format",
      });
    }

    res.status(500).json({
      success: false,
      message: "Failed to retry book generation",
    });
  }
};

module.exports = {
  createBook,
  getUserBooks,
  getBookById,
  updateBook,
  toggleBookPublic,
  deleteBook,
  retryBookGeneration,
};
