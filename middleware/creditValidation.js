const { body, query } = require("express-validator");

/**
 * Validation for credit purchase request
 */
const createPurchaseValidation = [
  body("creditAmount")
    .isInt({ min: 1, max: 100000 })
    .withMessage("Credit amount must be an integer between 1 and 100,000"),
];

/**
 * Validation for purchase verification request
 */
const verifyPurchaseValidation = [
  body("sessionId")
    .isString()
    .notEmpty()
    .withMessage("Session ID is required")
    .isLength({ min: 10, max: 200 })
    .withMessage("Invalid session ID format"),
];

/**
 * Validation for credit history pagination
 */
const creditHistoryValidation = [
  query("page")
    .optional()
    .isInt({ min: 1 })
    .withMessage("Page must be a positive integer"),
  query("limit")
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage("Limit must be an integer between 1 and 100"),
];

module.exports = {
  createPurchaseValidation,
  verifyPurchaseValidation,
  creditHistoryValidation,
};
