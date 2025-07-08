const express = require("express");
const { body, param, query } = require("express-validator");
const { pageController } = require("../controllers");
const { requireAuth } = require("../middleware");

const router = express.Router();

// Validation rules
const mongoIdValidation = param("id")
  .isMongoId()
  .withMessage("Invalid ID format");

const bookIdValidation = param("bookId")
  .isMongoId()
  .withMessage("Invalid book ID format");

const updatePageValidation = [
  body("text_content")
    .optional()
    .isString()
    .withMessage("Text content must be a string")
    .isLength({ min: 1, max: 2000 })
    .withMessage("Text content must be between 1 and 2000 characters")
    .trim(),
  body("illustration_url")
    .optional()
    .isURL()
    .withMessage("Illustration URL must be a valid URL"),
];

const batchUpdateValidation = [
  body("pageUpdates")
    .isArray({ min: 1 })
    .withMessage("Page updates must be a non-empty array"),
  body("pageUpdates.*.pageId")
    .isMongoId()
    .withMessage("Each page update must have a valid page ID"),
  body("pageUpdates.*.updateData")
    .isObject()
    .withMessage("Each page update must have update data"),
  body("pageUpdates.*.updateData.text_content")
    .optional()
    .isString()
    .withMessage("Text content must be a string")
    .isLength({ min: 1, max: 2000 })
    .withMessage("Text content must be between 1 and 2000 characters")
    .trim(),
  body("pageUpdates.*.updateData.illustration_url")
    .optional()
    .isURL()
    .withMessage("Illustration URL must be a valid URL"),
];

const queryValidation = [
  query("grouped")
    .optional()
    .isBoolean()
    .withMessage("Grouped parameter must be a boolean"),
];

// Routes

// Get all pages for a book
router.get(
  "/book/:bookId",
  bookIdValidation,
  queryValidation,
  pageController.getBookPages
);

// Get specific page by ID
router.get(
  "/:id",
  mongoIdValidation,
  pageController.getPageById
);

// Update a page
router.put(
  "/:id",
  requireAuth,
  mongoIdValidation,
  updatePageValidation,
  pageController.updatePage
);

// Update multiple pages in a batch
router.patch(
  "/batch-update",
  requireAuth,
  batchUpdateValidation,
  pageController.updateMultiplePages
);

module.exports = router;
