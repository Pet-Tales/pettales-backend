const illustrationService = require("../services/illustrationService");
const creditService = require("../services/creditService");
const { Book } = require("../models");
const logger = require("../utils/logger");

/**
 * Regenerate front cover illustration
 * @route POST /api/illustrations/regenerate/front-cover/:bookId
 * @access Private (Book Owner)
 */
const regenerateFrontCover = async (req, res) => {
  try {
    const { bookId } = req.params;
    const userId = req.user.id;
    const isFreeRegeneration = req.isFreeRegeneration;
    const requiredCredits = req.requiredCredits;
    const book = req.book;

    logger.info(`User ${userId} regenerating front cover for book ${bookId}`);

    // Deduct credits if not a free regeneration
    if (!isFreeRegeneration) {
      await creditService.deductCredits(
        userId,
        requiredCredits,
        `Front cover regeneration for "${book.title}"`,
        { bookId: book._id }
      );
    }

    // Increment regeneration counter
    await Book.findByIdAndUpdate(bookId, {
      $inc: { regenerations_used: 1 },
    });

    const newImageUrl = await illustrationService.regenerateFrontCover(
      bookId,
      userId
    );

    // Clean up temporary files
    await illustrationService.cleanupTempFiles();

    res.status(200).json({
      success: true,
      message: "Front cover regenerated successfully",
      data: {
        newImageUrl,
        isFreeRegeneration,
        creditsUsed: isFreeRegeneration ? 0 : requiredCredits,
        regenerationsUsed: (book.regenerations_used || 0) + 1,
      },
    });
  } catch (error) {
    logger.error("Regenerate front cover error:", error);

    // Refund credits if they were deducted and regeneration failed
    if (!req.isFreeRegeneration && req.requiredCredits) {
      try {
        await creditService.refundCredits(
          req.user.id,
          req.requiredCredits,
          `Refund for failed front cover regeneration: "${
            req.book?.title || "Unknown"
          }"`,
          { bookId: req.params.bookId }
        );
        logger.info(
          `Refunded ${req.requiredCredits} credits for failed front cover regeneration`
        );
      } catch (refundError) {
        logger.error("Failed to refund credits:", refundError);
      }
    }

    // Clean up temporary files on error
    try {
      await illustrationService.cleanupTempFiles();
    } catch (cleanupError) {
      logger.warn("Failed to cleanup temp files:", cleanupError);
    }

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

    res.status(500).json({
      success: false,
      message: "Failed to regenerate front cover",
      error: error.message,
    });
  }
};

/**
 * Regenerate back cover illustration
 * @route POST /api/illustrations/regenerate/back-cover/:bookId
 * @access Private (Book Owner)
 */
const regenerateBackCover = async (req, res) => {
  try {
    const { bookId } = req.params;
    const userId = req.user.id;
    const isFreeRegeneration = req.isFreeRegeneration;
    const requiredCredits = req.requiredCredits;
    const book = req.book;

    logger.info(`User ${userId} regenerating back cover for book ${bookId}`);

    // Deduct credits if not a free regeneration
    if (!isFreeRegeneration) {
      await creditService.deductCredits(
        userId,
        requiredCredits,
        `Back cover regeneration for "${book.title}"`,
        { bookId: book._id }
      );
    }

    // Increment regeneration counter
    await Book.findByIdAndUpdate(bookId, {
      $inc: { regenerations_used: 1 },
    });

    const newImageUrl = await illustrationService.regenerateBackCover(
      bookId,
      userId
    );

    // Clean up temporary files
    await illustrationService.cleanupTempFiles();

    res.status(200).json({
      success: true,
      message: "Back cover regenerated successfully",
      data: {
        newImageUrl,
        isFreeRegeneration,
        creditsUsed: isFreeRegeneration ? 0 : requiredCredits,
        regenerationsUsed: (book.regenerations_used || 0) + 1,
      },
    });
  } catch (error) {
    logger.error("Regenerate back cover error:", error);

    // Refund credits if they were deducted and regeneration failed
    if (!req.isFreeRegeneration && req.requiredCredits) {
      try {
        await creditService.refundCredits(
          req.user.id,
          req.requiredCredits,
          `Refund for failed back cover regeneration: "${
            req.book?.title || "Unknown"
          }"`,
          { bookId: req.params.bookId }
        );
        logger.info(
          `Refunded ${req.requiredCredits} credits for failed back cover regeneration`
        );
      } catch (refundError) {
        logger.error("Failed to refund credits:", refundError);
      }
    }

    // Clean up temporary files on error
    try {
      await illustrationService.cleanupTempFiles();
    } catch (cleanupError) {
      logger.warn("Failed to cleanup temp files:", cleanupError);
    }

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

    res.status(500).json({
      success: false,
      message: "Failed to regenerate back cover",
      error: error.message,
    });
  }
};

/**
 * Regenerate page illustration
 * @route POST /api/illustrations/regenerate/page/:pageId
 * @access Private (Book Owner)
 */
const regeneratePageIllustration = async (req, res) => {
  try {
    const { pageId } = req.params;
    const userId = req.user.id;
    const isFreeRegeneration = req.isFreeRegeneration;
    const requiredCredits = req.requiredCredits;
    const book = req.book;

    logger.info(
      `User ${userId} regenerating page illustration for page ${pageId}`
    );

    // Deduct credits if not a free regeneration
    if (!isFreeRegeneration) {
      await creditService.deductCredits(
        userId,
        requiredCredits,
        `Page illustration regeneration for "${book.title}"`,
        { bookId: book._id }
      );
    }

    // Increment regeneration counter
    await Book.findByIdAndUpdate(book._id, {
      $inc: { regenerations_used: 1 },
    });

    const newImageUrl = await illustrationService.regeneratePageIllustration(
      pageId,
      userId
    );

    // Clean up temporary files
    await illustrationService.cleanupTempFiles();

    res.status(200).json({
      success: true,
      message: "Page illustration regenerated successfully",
      data: {
        newImageUrl,
        isFreeRegeneration,
        creditsUsed: isFreeRegeneration ? 0 : requiredCredits,
        regenerationsUsed: (book.regenerations_used || 0) + 1,
      },
    });
  } catch (error) {
    logger.error("Regenerate page illustration error:", error);

    // Refund credits if they were deducted and regeneration failed
    if (!req.isFreeRegeneration && req.requiredCredits) {
      try {
        await creditService.refundCredits(
          req.user.id,
          req.requiredCredits,
          `Refund for failed page illustration regeneration: "${
            req.book?.title || "Unknown"
          }"`,
          { bookId: req.book?._id }
        );
        logger.info(
          `Refunded ${req.requiredCredits} credits for failed page illustration regeneration`
        );
      } catch (refundError) {
        logger.error("Failed to refund credits:", refundError);
      }
    }

    // Clean up temporary files on error
    try {
      await illustrationService.cleanupTempFiles();
    } catch (cleanupError) {
      logger.warn("Failed to cleanup temp files:", cleanupError);
    }

    // Handle specific errors
    if (error.message === "Page not found") {
      return res.status(404).json({
        success: false,
        message: "Page not found",
      });
    }

    if (error.message === "Book not found") {
      return res.status(404).json({
        success: false,
        message: "Book not found",
      });
    }

    if (error.message === "Page is not an illustration page") {
      return res.status(400).json({
        success: false,
        message: "Page is not an illustration page",
      });
    }

    if (error.message === "Access denied") {
      return res.status(403).json({
        success: false,
        message: "Access denied",
      });
    }

    res.status(500).json({
      success: false,
      message: "Failed to regenerate page illustration",
      error: error.message,
    });
  }
};

module.exports = {
  regenerateFrontCover,
  regenerateBackCover,
  regeneratePageIllustration,
};
