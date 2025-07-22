const express = require("express");
const { param, query } = require("express-validator");
const { galleryController } = require("../controllers");
const { authenticateUser } = require("../middleware");

const router = express.Router();

// Validation rules
const mongoIdValidation = param("id")
  .isMongoId()
  .withMessage("Invalid ID format");

const languageValidation = param("language")
  .isIn(["en", "es"])
  .withMessage("Language must be either 'en' or 'es'");

const paginationValidation = [
  query("page")
    .optional()
    .isInt({ min: 1 })
    .withMessage("Page must be a positive integer"),
  query("limit")
    .optional()
    .isInt({ min: 1, max: 50 })
    .withMessage("Limit must be between 1 and 50"),
  query("search")
    .optional()
    .isString()
    .trim()
    .isLength({ max: 100 })
    .withMessage("Search query must not exceed 100 characters"),
  query("sortBy")
    .optional()
    .isIn(["created_at", "updated_at", "title"])
    .withMessage("Sort by must be 'created_at', 'updated_at', or 'title'"),
  query("sortOrder")
    .optional()
    .isIn(["asc", "desc"])
    .withMessage("Sort order must be 'asc' or 'desc'"),
];

const featuredLimitValidation = [
  query("limit")
    .optional()
    .isInt({ min: 1, max: 20 })
    .withMessage("Limit must be between 1 and 20"),
];

// Routes

// Get all public books with pagination and search
router.get("/", paginationValidation, galleryController.getPublicBooks);

// Get featured public books
router.get(
  "/featured",
  featuredLimitValidation,
  galleryController.getFeaturedBooks
);

// Get gallery statistics
router.get("/stats", galleryController.getGalleryStats);

// Get public books by language
router.get(
  "/language/:language",
  languageValidation,
  paginationValidation,
  galleryController.getPublicBooksByLanguage
);

// Get book template data for creating a new book
router.get(
  "/template/:id",
  authenticateUser,
  mongoIdValidation,
  galleryController.getBookForTemplate
);

module.exports = router;
