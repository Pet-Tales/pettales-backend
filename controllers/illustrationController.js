const illustrationService = require("../services/illustrationService");
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

    logger.info(`User ${userId} regenerating front cover for book ${bookId}`);

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
      },
    });
  } catch (error) {
    logger.error("Regenerate front cover error:", error);

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

    logger.info(`User ${userId} regenerating back cover for book ${bookId}`);

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
      },
    });
  } catch (error) {
    logger.error("Regenerate back cover error:", error);

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

    logger.info(
      `User ${userId} regenerating page illustration for page ${pageId}`
    );

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
      },
    });
  } catch (error) {
    logger.error("Regenerate page illustration error:", error);

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
