const { validationResult } = require("express-validator");
const mongoose = require("mongoose");
const BookService = require("../services/bookService");
const { pdfRegenerationService } = require("../services/pdfService");
const bookPurchaseService = require("../services/bookPurchaseService");
const stripeService = require("../services/stripeService");
const logger = require("../utils/logger");
const https = require("https");
const http = require("http");
const { CREDIT_COSTS } = require("../utils/constants");
// const { useErrorTranslation } = require("../utils/errorMapper");

const bookService = new BookService();

/**
 * Create a new book
 */
const createBook = async (req, res) => {
  try {
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
    
    // Check rate limiting for free generation
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const recentBooksCount = await Book.countDocuments({
      user_id: userId,
      created_at: { $gt: oneHourAgo },
    });

    const hourlyLimit = parseInt(process.env.HOURLY_GENERATION_LIMIT || 3);
    if (recentBooksCount >= hourlyLimit) {
      return res.status(429).json({
        success: false,
        message: `Generation limit reached (${hourlyLimit} per hour). Please try again later.`,
      });
    }

    // Create book WITHOUT credit deduction
    const book = await bookService.createBook(userId, bookData);

    res.status(201).json({
      success: true,
      message: "Book created successfully! Generation is FREE.",
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

/**
 * Regenerate PDF for a book
 */
const regeneratePDF = async (req, res) => {
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

    logger.info(`User ${userId} regenerating PDF for book ${id}`);

    const newPdfUrl = await pdfRegenerationService.regeneratePDF(id, userId);

    res.json({
      success: true,
      message: "PDF regenerated successfully",
      data: { pdfUrl: newPdfUrl },
    });
  } catch (error) {
    logger.error(`Regenerate PDF error: ${error.message}`);

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

    if (error.message === "Book generation not completed") {
      return res.status(400).json({
        success: false,
        message: "Book generation not completed",
      });
    }

    res.status(500).json({
      success: false,
      message: "Failed to regenerate PDF",
      error: error.message,
    });
  }
};

/**
 * Check if book content has changed since PDF was generated
 */
const checkPDFStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user._id.toString();

    // Additional check for valid ObjectId format
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid book ID format",
      });
    }

    const hasChanged = await pdfRegenerationService.hasContentChanged(id);

    res.json({
      success: true,
      data: {
        hasContentChanged: hasChanged,
        needsRegeneration: hasChanged,
      },
    });
  } catch (error) {
    logger.error(`Check PDF status error: ${error.message}`);

    res.status(500).json({
      success: false,
      message: "Failed to check PDF status",
      error: error.message,
    });
  }
};

/**
 * Download PDF for a book (proxy to handle CORS)
 */
const downloadPDF = async (req, res) => {
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

    // Get book and check access permissions
    const book = await bookService.getBookById(id, userId);

    if (!book.pdfUrl) {
      return res.status(404).json({
        success: false,
        message: "PDF not available for this book",
      });
    }

    // Check if user is the book owner (free download)
    const isOwner = userId && book.isOwner;

    if (isOwner) {
      // Book owner gets free download
      logger.info(`Book owner ${userId} downloading PDF for book ${id}`);
      return streamPDFToClient(book, id, res);
    }

    // For non-owners downloading public books, payment is required
    if (!book.isPublic) {
      return res.status(403).json({
        success: false,
        message: "Access denied",
      });
    }

    // Check for valid session ID (from successful payment) - works for both guests and authenticated users
    const sessionId = req.query.session_id;
    if (sessionId) {
      try {
        const isValidSession = await stripeService.isSessionCompletedForBook(
          sessionId,
          id
        );

        if (isValidSession) {
          const userType = userId ? "authenticated user" : "guest user";
          logger.info(
            `${userType} with valid session ${sessionId} downloading PDF for book ${id}`
          );
          return streamPDFToClient(book, id, res);
        } else {
          logger.warn(`Invalid session ${sessionId} provided for book ${id}`);
        }
      } catch (sessionError) {
        logger.error(`Error verifying session: ${sessionError.message}`);
      }
    }

    // No valid session - redirect to Stripe checkout (same flow for both guests and authenticated users)
    // Charity selection logic: if any enabled charities exist, require charity_id before creating checkout
    const { Charity } = require("../models");
    const enabledCount = await Charity.countDocuments({ is_enabled: true });
    const charityId = req.query.charity_id;

    if (enabledCount > 0 && !charityId) {
      return res.json({
        success: true,
        requiresPayment: true,
        charityRequired: true,
        message: "Charity selection required before payment",
      });
    }

    // Build user and stripe checkout
    let checkoutUserId, userEmail;

    if (userId) {
      // Authenticated user
      checkoutUserId = userId;
      userEmail = req.user.email;
      logger.info(
        `Authenticated user ${userId} requesting PDF download for book ${id}, redirecting to payment`
      );
    } else {
      // Guest user - create a temporary user identifier for the session
      checkoutUserId = `guest_${Date.now()}_${Math.random()
        .toString(36)
        .substr(2, 9)}`;
      userEmail = null;
      logger.info(
        `Guest user requesting PDF download for book ${id}, redirecting to payment`
      );
    }

    try {
      // If charityId is present, validate it and include metadata
      let charityMeta = {};
      if (charityId) {
        const charity = await Charity.findOne({
          _id: charityId,
          is_enabled: true,
        });
        if (!charity) {
          return res
            .status(400)
            .json({ success: false, message: "Invalid charity selection" });
        }
        charityMeta = {
          charityId: charity._id.toString(),
          charityName: charity.name,
        };
      }

      const session = await stripeService.createCreditPurchaseSession(
        checkoutUserId,
        CREDIT_COSTS.PDF_DOWNLOAD,
        userEmail,
        "pdf-download",
        {
          bookId: id,
          returnUrl: `/books/${id}`,
          ...charityMeta,
        }
      );

      return res.json({
        success: true,
        requiresPayment: true,
        isGuest: !userId,
        checkoutUrl: session.url,
        message: "Payment required for PDF download",
      });
    } catch (stripeError) {
      logger.error(
        `Failed to create checkout session for ${
          userId ? "user" : "guest"
        } ${checkoutUserId}: ${stripeError.message}`
      );
      return res.status(500).json({
        success: false,
        message: "Failed to create payment session",
      });
    }
  } catch (error) {
    logger.error(`Download PDF error: ${error.message}`);

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

    if (!res.headersSent) {
      res.status(500).json({
        success: false,
        message: "Failed to download PDF",
      });
    }
  }
};

/**
 * Helper function to stream PDF to client
 */
const streamPDFToClient = (book, bookId, res) => {
  const protocol = book.pdfUrl.startsWith("https:") ? https : http;

  const request = protocol.get(book.pdfUrl, (response) => {
    if (response.statusCode !== 200) {
      logger.error(
        `Failed to fetch PDF from ${book.pdfUrl}: ${response.statusCode}`
      );
      return res.status(404).json({
        success: false,
        message: "PDF file not found",
      });
    }

    // Set appropriate headers for PDF download
    const filename = `${book.title
      .replace(/[^a-zA-Z0-9\s-_]/g, "")
      .replace(/\s+/g, "_")}_${bookId}.pdf`;
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.setHeader("Cache-Control", "no-cache");

    // Pipe the PDF response to the client
    response.pipe(res);
  });

  request.on("error", (error) => {
    logger.error(`Error streaming PDF for book ${bookId}: ${error.message}`);
    if (!res.headersSent) {
      res.status(500).json({
        success: false,
        message: "Failed to download PDF",
      });
    }
  });

  request.setTimeout(30000, () => {
    logger.error(`Timeout streaming PDF for book ${bookId}`);
    if (!res.headersSent) {
      res.status(504).json({
        success: false,
        message: "Download timeout",
      });
    }
    request.destroy();
  });
};
/**
 * Create checkout session for book download
 */
const createDownloadCheckout = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user ? req.user._id.toString() : null;
    const userEmail = req.user?.email || req.body.email;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid book ID format",
      });
    }

    const session = await bookPurchaseService.createDownloadCheckout(
      id,
      userId,
      userEmail
    );

    res.json({
      success: true,
      message: "Checkout session created",
      data: {
        checkoutUrl: session.url,
        sessionId: session.id,
      },
    });
  } catch (error) {
    logger.error(`Create download checkout error: ${error.message}`);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to create checkout session",
    });
  }
};

/**
 * Verify purchase and get download URL
 */
const getDownloadUrl = async (req, res) => {
  try {
    const { id } = req.params;
    const { session_id } = req.query;
    const userId = req.user ? req.user._id.toString() : null;

    if (!session_id) {
      return res.status(400).json({
        success: false,
        message: "Session ID required",
      });
    }

    const downloadInfo = await bookPurchaseService.verifyAndGetDownload(
      id,
      session_id,
      userId
    );

    res.json({
      success: true,
      data: downloadInfo,
    });
  } catch (error) {
    logger.error(`Get download URL error: ${error.message}`);
    res.status(400).json({
      success: false,
      message: error.message || "Failed to get download URL",
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
  regeneratePDF,
  checkPDFStatus,
  downloadPDF,
  createDownloadCheckout,
  getDownloadUrl,
};

