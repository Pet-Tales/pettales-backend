const express = require("express");
const { body, param, query } = require("express-validator");
const { bookController } = require("../controllers");
const { requireAuth } = require("../middleware");
const router = express.Router();

// Validation rules
const mongoIdValidation = param("id")
  .isMongoId()
  .withMessage("Invalid ID format");

const createBookValidation = [
  body("title")
    .isLength({ min: 2, max: 100 })
    .withMessage("Title must be between 2 and 100 characters")
    .trim(),
  body("description")
    .isLength({ min: 10, max: 500 })
    .withMessage("Description must be between 10 and 500 characters")
    .trim(),
  body("moral")
    .isLength({ min: 5, max: 200 })
    .withMessage("Moral must be between 5 and 200 characters")
    .trim(),
  body("dedication")
    .optional()
    .isLength({ max: 200 })
    .withMessage("Dedication must not exceed 200 characters")
    .trim(),
  body("language")
    .isIn(["en", "es"])
    .withMessage("Language must be either 'en' or 'es'"),
  body("page_count")
    .isInt({ min: 12, max: 24 })
    .withMessage("Page count must be 12, 16, or 24")
    .custom((value) => {
      if (![12, 16, 24].includes(value)) {
        throw new Error("Page count must be 12, 16, or 24");
      }
      return true;
    }),
  body("illustration_style")
    .isIn(["anime", "disney", "vector_art", "classic_watercolor"])
    .withMessage(
      "Illustration style must be 'anime', 'disney', 'vector_art', or 'classic_watercolor'"
    ),
  body("character_ids")
    .isArray({ min: 1, max: 3 })
    .withMessage("Must select between 1 and 3 characters")
    .custom((value) => {
      if (!Array.isArray(value)) {
        throw new Error("Character IDs must be an array");
      }
      if (value.some((id) => typeof id !== "string" || id.length !== 24)) {
        throw new Error("All character IDs must be valid MongoDB ObjectIds");
      }
      return true;
    }),
];

const updateBookValidation = [
  body("title")
    .optional()
    .isLength({ min: 2, max: 100 })
    .withMessage("Title must be between 2 and 100 characters")
    .trim(),
  body("description")
    .optional()
    .isLength({ min: 10, max: 500 })
    .withMessage("Description must be between 10 and 500 characters")
    .trim(),
  body("moral")
    .optional()
    .isLength({ min: 5, max: 200 })
    .withMessage("Moral must be between 5 and 200 characters")
    .trim(),
  body("dedication")
    .optional()
    .isLength({ max: 200 })
    .withMessage("Dedication must not exceed 200 characters")
    .trim(),
  body("moral_of_back_cover")
    .optional()
    .isLength({ max: 300 })
    .withMessage("Back cover moral must not exceed 300 characters")
    .trim(),
  body("front_cover_image_url")
    .optional()
    .isURL()
    .withMessage("Front cover image URL must be a valid URL"),
  body("back_cover_image_url")
    .optional()
    .isURL()
    .withMessage("Back cover image URL must be a valid URL"),
];

const paginationValidation = [
  query("page")
    .optional()
    .isInt({ min: 1 })
    .withMessage("Page must be a positive integer"),
  query("limit")
    .optional()
    .isInt({ min: 1, max: 50 })
    .withMessage("Limit must be between 1 and 50"),
  query("status")
    .optional()
    .isIn(["pending", "generating", "completed", "failed"])
    .withMessage(
      "Status must be 'pending', 'generating', 'completed', or 'failed'"
    ),
  query("sortBy")
    .optional()
    .isIn(["created_at", "updated_at", "title"])
    .withMessage("Sort by must be 'created_at', 'updated_at', or 'title'"),
  query("sortOrder")
    .optional()
    .isIn(["asc", "desc"])
    .withMessage("Sort order must be 'asc' or 'desc'"),
];

// Routes

// Create new book
router.post(
  "/",
  requireAuth,
  createBookValidation,
  bookController.createBook
);

// Get user's books with pagination
router.get("/", requireAuth, paginationValidation, bookController.getUserBooks);

// Get specific book by ID
router.get("/:id", mongoIdValidation, bookController.getBookById);

// Update book metadata
router.put(
  "/:id",
  requireAuth,
  mongoIdValidation,
  updateBookValidation,
  bookController.updateBook
);

// Toggle book public/private status
router.patch(
  "/:id/toggle-public",
  requireAuth,
  mongoIdValidation,
  bookController.toggleBookPublic
);

// Delete book
router.delete(
  "/:id",
  requireAuth,
  mongoIdValidation,
  bookController.deleteBook
);

// Retry failed book generation
router.post(
  "/:id/retry",
  requireAuth,
  mongoIdValidation,
  bookController.retryBookGeneration
);

// Regenerate PDF for a book
router.post(
  "/:id/regenerate-pdf",
  requireAuth,
  mongoIdValidation,
  bookController.regeneratePDF
);

// Check if book content has changed (for PDF regeneration button state)
router.get(
  "/:id/pdf-status",
  requireAuth,
  mongoIdValidation,
  bookController.checkPDFStatus
);

// Download PDF for a book (handles CORS issues)
router.get("/:id/download-pdf", mongoIdValidation, bookController.downloadPDF);
// Create download checkout session
router.post(
  "/:id/purchase-download",
  mongoIdValidation,
  bookController.createDownloadCheckout
);

// Get download URL after purchase
router.get(
  "/:id/download-url",
  mongoIdValidation,
  bookController.getDownloadUrl
);

module.exports = router;
