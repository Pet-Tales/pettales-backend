const { validationResult } = require("express-validator");
const mongoose = require("mongoose");
const GalleryService = require("../services/galleryService");
const logger = require("../utils/logger");

const galleryService = new GalleryService();

/**
 * Get public books for gallery
 */
const getPublicBooks = async (req, res) => {
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

    const options = {
      page: parseInt(req.query.page) || 1,
      limit: parseInt(req.query.limit) || 12,
      search: req.query.search || "",
      sortBy: req.query.sortBy || "created_at",
      sortOrder: req.query.sortOrder || "desc",
    };

    const result = await galleryService.getPublicBooks(options);

    res.json({
      success: true,
      message: "Public books retrieved successfully",
      data: result,
    });
  } catch (error) {
    logger.error(`Get public books error: ${error.message}`);
    res.status(500).json({
      success: false,
      message: "Failed to retrieve public books",
    });
  }
};

/**
 * Get book template data for creating a new book
 */
const getBookForTemplate = async (req, res) => {
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

    // Additional check for valid ObjectId format
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid book ID format",
      });
    }

    const templateData = await galleryService.getBookForTemplate(id);

    res.json({
      success: true,
      message: "Book template retrieved successfully",
      data: { template: templateData },
    });
  } catch (error) {
    logger.error(`Get book template error: ${error.message}`);

    // Handle specific errors
    if (error.message === "Public book not found") {
      return res.status(404).json({
        success: false,
        message: "Public book not found",
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
      message: "Failed to retrieve book template",
    });
  }
};

/**
 * Get featured public books
 */
const getFeaturedBooks = async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 6;

    if (limit < 1 || limit > 20) {
      return res.status(400).json({
        success: false,
        message: "Limit must be between 1 and 20",
      });
    }

    const books = await galleryService.getFeaturedBooks(limit);

    res.json({
      success: true,
      message: "Featured books retrieved successfully",
      data: { books },
    });
  } catch (error) {
    logger.error(`Get featured books error: ${error.message}`);
    res.status(500).json({
      success: false,
      message: "Failed to retrieve featured books",
    });
  }
};

/**
 * Get public books by language
 */
const getPublicBooksByLanguage = async (req, res) => {
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

    const { language } = req.params;
    const options = {
      page: parseInt(req.query.page) || 1,
      limit: parseInt(req.query.limit) || 12,
      sortBy: req.query.sortBy || "created_at",
      sortOrder: req.query.sortOrder || "desc",
    };

    const result = await galleryService.getPublicBooksByLanguage(language, options);

    res.json({
      success: true,
      message: `Public books in ${language} retrieved successfully`,
      data: result,
    });
  } catch (error) {
    logger.error(`Get public books by language error: ${error.message}`);
    res.status(500).json({
      success: false,
      message: "Failed to retrieve public books by language",
    });
  }
};

/**
 * Get gallery statistics
 */
const getGalleryStats = async (req, res) => {
  try {
    const stats = await galleryService.getGalleryStats();

    res.json({
      success: true,
      message: "Gallery statistics retrieved successfully",
      data: { stats },
    });
  } catch (error) {
    logger.error(`Get gallery stats error: ${error.message}`);
    res.status(500).json({
      success: false,
      message: "Failed to retrieve gallery statistics",
    });
  }
};

module.exports = {
  getPublicBooks,
  getBookForTemplate,
  getFeaturedBooks,
  getPublicBooksByLanguage,
  getGalleryStats,
};
