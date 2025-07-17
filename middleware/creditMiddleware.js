const creditService = require("../services/creditService");
const { CREDIT_COSTS } = require("../utils/constants");
const logger = require("../utils/logger");

/**
 * Middleware to validate sufficient credits for book generation
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
const validateBookGenerationCredits = async (req, res, next) => {
  try {
    const userId = req.user._id.toString();
    const { page_count: pageCount } = req.body;

    // Determine required credits based on page count
    let requiredCredits;
    switch (pageCount) {
      case 12:
        requiredCredits = CREDIT_COSTS.BOOK_12_PAGES;
        break;
      case 16:
        requiredCredits = CREDIT_COSTS.BOOK_16_PAGES;
        break;
      case 24:
        requiredCredits = CREDIT_COSTS.BOOK_24_PAGES;
        break;
      default:
        return res.status(400).json({
          success: false,
          message: "Invalid page count. Must be 12, 16, or 24 pages.",
        });
    }

    // Check if user has sufficient credits
    const hasSufficientCredits = await creditService.hasSufficientCredits(
      userId,
      requiredCredits
    );

    if (!hasSufficientCredits) {
      logger.warn(
        `User ${userId} attempted book generation without sufficient credits. Required: ${requiredCredits}, Available: ${req.user.credits_balance}`
      );

      return res.status(402).json({
        success: false,
        message: "Insufficient credits for book generation",
        error: "INSUFFICIENT_CREDITS",
        data: {
          required: requiredCredits,
          available: req.user.credits_balance,
          shortfall: requiredCredits - req.user.credits_balance,
        },
      });
    }

    // Store required credits in request for later use
    req.requiredCredits = requiredCredits;
    next();
  } catch (error) {
    logger.error(`Credit validation error: ${error.message}`);
    res.status(500).json({
      success: false,
      message: "Failed to validate credits",
      error: error.message,
    });
  }
};

/**
 * Middleware to validate sufficient credits for illustration regeneration
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
const validateRegenerationCredits = async (req, res, next) => {
  try {
    const userId = req.user._id.toString();
    const { Book } = require("../models");

    // Get book information to check free regeneration limits
    let bookId;

    // Extract book ID from different possible sources
    if (req.params.bookId) {
      bookId = req.params.bookId;
    } else if (req.params.pageId) {
      // For page regeneration, we need to get the book ID from the page
      const { Page } = require("../models");
      const page = await Page.findById(req.params.pageId);
      if (!page) {
        return res.status(404).json({
          success: false,
          message: "Page not found",
        });
      }
      bookId = page.book_id;
    } else {
      return res.status(400).json({
        success: false,
        message: "Book ID or Page ID required",
      });
    }

    const book = await Book.findById(bookId);
    if (!book) {
      return res.status(404).json({
        success: false,
        message: "Book not found",
      });
    }

    // Check if user owns the book
    if (book.user_id.toString() !== userId) {
      return res.status(403).json({
        success: false,
        message: "Access denied. You don't own this book.",
      });
    }

    // Get free regeneration limit for this book's page count
    const { FREE_REGENERATION_LIMITS } = require("../utils/constants");
    const freeLimit = FREE_REGENERATION_LIMITS[book.page_count] || 0;
    const currentRegenerations = book.regenerations_used || 0;

    // Check if user still has free regenerations
    if (currentRegenerations < freeLimit) {
      logger.info(
        `User ${userId} using free regeneration ${
          currentRegenerations + 1
        }/${freeLimit} for book ${bookId}`
      );

      // Store that this is a free regeneration
      req.isFreeRegeneration = true;
      req.book = book;
      next();
      return;
    }

    // User has exceeded free limit, check if they have enough credits
    const requiredCredits = CREDIT_COSTS.ILLUSTRATION_REGENERATION;
    const hasSufficientCredits = await creditService.hasSufficientCredits(
      userId,
      requiredCredits
    );

    if (!hasSufficientCredits) {
      logger.warn(
        `User ${userId} attempted regeneration without sufficient credits. Required: ${requiredCredits}, Available: ${req.user.credits_balance}`
      );

      return res.status(402).json({
        success: false,
        message: "Insufficient credits for illustration regeneration",
        error: "INSUFFICIENT_CREDITS",
        data: {
          required: requiredCredits,
          available: req.user.credits_balance,
          shortfall: requiredCredits - req.user.credits_balance,
          freeRegenerationsUsed: currentRegenerations,
          freeRegenerationsLimit: freeLimit,
        },
      });
    }

    // Store required credits and book info for later use
    req.requiredCredits = requiredCredits;
    req.isFreeRegeneration = false;
    req.book = book;
    next();
  } catch (error) {
    logger.error(`Regeneration credit validation error: ${error.message}`);
    res.status(500).json({
      success: false,
      message: "Failed to validate regeneration credits",
      error: error.message,
    });
  }
};

module.exports = {
  validateBookGenerationCredits,
  validateRegenerationCredits,
};
