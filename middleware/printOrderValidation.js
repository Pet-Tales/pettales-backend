const { body, param, query, validationResult } = require("express-validator");
const logger = require("../utils/logger");

/**
 * Handle validation errors
 */
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    logger.warn("Validation failed:", errors.array());
    return res.status(400).json({
      success: false,
      message: "Validation failed",
      errors: errors.array(),
    });
  }
  next();
};

/**
 * Validation for calculate cost endpoint
 */
const calculateCostValidation = [
  body("bookId")
    .isMongoId()
    .withMessage("Valid book ID is required"),
  
  body("quantity")
    .isInt({ min: 1, max: 100 })
    .withMessage("Quantity must be between 1 and 100"),
  
  body("shippingAddress.name")
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage("Name is required and must be less than 100 characters"),
  
  body("shippingAddress.street1")
    .trim()
    .isLength({ min: 1, max: 200 })
    .withMessage("Street address is required and must be less than 200 characters"),
  
  body("shippingAddress.street2")
    .optional()
    .trim()
    .isLength({ max: 200 })
    .withMessage("Street address 2 must be less than 200 characters"),
  
  body("shippingAddress.city")
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage("City is required and must be less than 100 characters"),
  
  body("shippingAddress.state_code")
    .optional()
    .trim()
    .isLength({ max: 10 })
    .withMessage("State code must be less than 10 characters"),
  
  body("shippingAddress.postcode")
    .trim()
    .isLength({ min: 1, max: 20 })
    .withMessage("Postal code is required and must be less than 20 characters"),
  
  body("shippingAddress.country_code")
    .isLength({ min: 2, max: 2 })
    .isAlpha()
    .toUpperCase()
    .withMessage("Valid 2-letter country code is required"),
  
  body("shippingAddress.phone_number")
    .trim()
    .matches(/^[\+]?[\d\s\-\.\(\)]{8,20}$/)
    .withMessage("Valid phone number is required (8-20 characters)"),
  
  body("shippingAddress.email")
    .isEmail()
    .normalizeEmail()
    .withMessage("Valid email address is required"),
  
  body("shippingLevel")
    .isIn(["MAIL", "PRIORITY_MAIL", "GROUND", "EXPEDITED", "EXPRESS"])
    .withMessage("Valid shipping level is required"),
  
  handleValidationErrors,
];

/**
 * Validation for create print order endpoint
 */
const createPrintOrderValidation = [
  body("bookId")
    .isMongoId()
    .withMessage("Valid book ID is required"),
  
  body("quantity")
    .isInt({ min: 1, max: 100 })
    .withMessage("Quantity must be between 1 and 100"),
  
  body("shippingAddress.name")
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage("Name is required and must be less than 100 characters"),
  
  body("shippingAddress.street1")
    .trim()
    .isLength({ min: 1, max: 200 })
    .withMessage("Street address is required and must be less than 200 characters"),
  
  body("shippingAddress.street2")
    .optional()
    .trim()
    .isLength({ max: 200 })
    .withMessage("Street address 2 must be less than 200 characters"),
  
  body("shippingAddress.city")
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage("City is required and must be less than 100 characters"),
  
  body("shippingAddress.state_code")
    .optional()
    .trim()
    .isLength({ max: 10 })
    .withMessage("State code must be less than 10 characters"),
  
  body("shippingAddress.postcode")
    .trim()
    .isLength({ min: 1, max: 20 })
    .withMessage("Postal code is required and must be less than 20 characters"),
  
  body("shippingAddress.country_code")
    .isLength({ min: 2, max: 2 })
    .isAlpha()
    .toUpperCase()
    .withMessage("Valid 2-letter country code is required"),
  
  body("shippingAddress.phone_number")
    .trim()
    .matches(/^[\+]?[\d\s\-\.\(\)]{8,20}$/)
    .withMessage("Valid phone number is required (8-20 characters)"),
  
  body("shippingAddress.email")
    .isEmail()
    .normalizeEmail()
    .withMessage("Valid email address is required"),
  
  body("shippingLevel")
    .isIn(["MAIL", "PRIORITY_MAIL", "GROUND", "EXPEDITED", "EXPRESS"])
    .withMessage("Valid shipping level is required"),
  
  handleValidationErrors,
];

/**
 * Validation for get print orders endpoint
 */
const getPrintOrdersValidation = [
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
    .isIn([
      "created",
      "unpaid",
      "payment_in_progress",
      "production_delayed",
      "production_ready",
      "in_production",
      "shipped",
      "rejected",
      "canceled",
    ])
    .withMessage("Invalid status filter"),
  
  handleValidationErrors,
];

/**
 * Validation for print order ID parameter
 */
const printOrderIdValidation = [
  param("orderId")
    .isMongoId()
    .withMessage("Valid order ID is required"),
  
  handleValidationErrors,
];

/**
 * Validation for shipping options endpoint
 */
const shippingOptionsValidation = [
  body("shippingAddress.country_code")
    .isLength({ min: 2, max: 2 })
    .isAlpha()
    .toUpperCase()
    .withMessage("Valid 2-letter country code is required"),
  
  body("shippingAddress.city")
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage("City is required and must be less than 100 characters"),
  
  body("shippingAddress.postcode")
    .optional()
    .trim()
    .isLength({ max: 20 })
    .withMessage("Postal code must be less than 20 characters"),
  
  handleValidationErrors,
];

module.exports = {
  calculateCostValidation,
  createPrintOrderValidation,
  getPrintOrdersValidation,
  printOrderIdValidation,
  shippingOptionsValidation,
};
