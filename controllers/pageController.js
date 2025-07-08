const { validationResult } = require("express-validator");
const mongoose = require("mongoose");
const PageService = require("../services/pageService");
const logger = require("../utils/logger");

const pageService = new PageService();

/**
 * Get all pages for a book
 */
const getBookPages = async (req, res) => {
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

    const { bookId } = req.params;
    const userId = req.user ? req.user._id.toString() : null;
    const grouped = req.query.grouped === "true";

    // Additional check for valid ObjectId format
    if (!mongoose.Types.ObjectId.isValid(bookId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid book ID format",
      });
    }

    let pages;
    if (grouped) {
      pages = await pageService.getGroupedBookPages(bookId, userId);
    } else {
      pages = await pageService.getBookPages(bookId, userId);
    }

    res.json({
      success: true,
      message: "Pages retrieved successfully",
      data: { pages },
    });
  } catch (error) {
    logger.error(`Get book pages error: ${error.message}`);

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
      message: "Failed to retrieve pages",
    });
  }
};

/**
 * Get a specific page by ID
 */
const getPageById = async (req, res) => {
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
        message: "Invalid page ID format",
      });
    }

    const page = await pageService.getPageById(id, userId);

    res.json({
      success: true,
      message: "Page retrieved successfully",
      data: { page },
    });
  } catch (error) {
    logger.error(`Get page by ID error: ${error.message}`);

    // Handle specific errors
    if (error.message === "Page not found") {
      return res.status(404).json({
        success: false,
        message: "Page not found",
      });
    }

    if (error.message === "Associated book not found") {
      return res.status(404).json({
        success: false,
        message: "Associated book not found",
      });
    }

    if (error.message === "Access denied") {
      return res.status(403).json({
        success: false,
        message: "Access denied",
      });
    }

    if (error.message === "Invalid page ID format") {
      return res.status(400).json({
        success: false,
        message: "Invalid page ID format",
      });
    }

    res.status(500).json({
      success: false,
      message: "Failed to retrieve page",
    });
  }
};

/**
 * Update a page
 */
const updatePage = async (req, res) => {
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
        message: "Invalid page ID format",
      });
    }

    const page = await pageService.updatePage(id, userId, updateData);

    res.json({
      success: true,
      message: "Page updated successfully",
      data: { page },
    });
  } catch (error) {
    logger.error(`Update page error: ${error.message}`);

    // Handle specific errors
    if (error.message === "Page not found") {
      return res.status(404).json({
        success: false,
        message: "Page not found",
      });
    }

    if (error.message === "Associated book not found") {
      return res.status(404).json({
        success: false,
        message: "Associated book not found",
      });
    }

    if (error.message === "Access denied") {
      return res.status(403).json({
        success: false,
        message: "Access denied",
      });
    }

    if (error.message === "Only completed books can be edited") {
      return res.status(400).json({
        success: false,
        message: "Only completed books can be edited",
      });
    }

    if (error.message.includes("Text content")) {
      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }

    if (error.message.includes("Illustration URL")) {
      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }

    if (error.message === "No valid updates provided") {
      return res.status(400).json({
        success: false,
        message: "No valid updates provided",
      });
    }

    if (error.message === "Invalid page ID format") {
      return res.status(400).json({
        success: false,
        message: "Invalid page ID format",
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
      message: "Failed to update page",
    });
  }
};

/**
 * Update multiple pages in a batch
 */
const updateMultiplePages = async (req, res) => {
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
    const { pageUpdates } = req.body;

    if (!Array.isArray(pageUpdates) || pageUpdates.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Page updates must be a non-empty array",
      });
    }

    // Validate each page update
    for (const update of pageUpdates) {
      if (!update.pageId || !mongoose.Types.ObjectId.isValid(update.pageId)) {
        return res.status(400).json({
          success: false,
          message: "All page updates must have valid page IDs",
        });
      }
      if (!update.updateData || typeof update.updateData !== "object") {
        return res.status(400).json({
          success: false,
          message: "All page updates must have update data",
        });
      }
    }

    const results = await pageService.updateMultiplePages(pageUpdates, userId);

    // Check if any updates failed
    const failedUpdates = results.filter(result => result.success === false);
    const successfulUpdates = results.filter(result => result.success !== false);

    res.json({
      success: true,
      message: `${successfulUpdates.length} pages updated successfully${
        failedUpdates.length > 0 ? `, ${failedUpdates.length} failed` : ""
      }`,
      data: {
        successful: successfulUpdates,
        failed: failedUpdates,
        totalProcessed: results.length,
      },
    });
  } catch (error) {
    logger.error(`Update multiple pages error: ${error.message}`);
    res.status(500).json({
      success: false,
      message: "Failed to update pages",
    });
  }
};

module.exports = {
  getBookPages,
  getPageById,
  updatePage,
  updateMultiplePages,
};
