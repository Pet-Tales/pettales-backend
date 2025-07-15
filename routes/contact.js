const express = require("express");
const { body } = require("express-validator");
const { submitContactForm } = require("../controllers/contactController");
const { handleValidationErrors } = require("../middleware");

const router = express.Router();

// Validation middleware for contact form
const contactFormValidation = [
  body("name")
    .trim()
    .notEmpty()
    .withMessage("Name is required")
    .isLength({ min: 1, max: 100 })
    .withMessage("Name must be between 1 and 100 characters"),
  
  body("email")
    .trim()
    .notEmpty()
    .withMessage("Email is required")
    .isEmail()
    .withMessage("Please provide a valid email address")
    .normalizeEmail(),
  
  body("subject")
    .trim()
    .notEmpty()
    .withMessage("Subject is required")
    .isLength({ min: 1, max: 200 })
    .withMessage("Subject must be between 1 and 200 characters"),
  
  body("message")
    .trim()
    .notEmpty()
    .withMessage("Message is required")
    .isLength({ min: 10, max: 2000 })
    .withMessage("Message must be between 10 and 2000 characters"),
  
  body("language")
    .optional()
    .isIn(["en", "es"])
    .withMessage("Language must be either 'en' or 'es'"),
  
  handleValidationErrors,
];

/**
 * @route POST /api/contact
 * @desc Submit contact form
 * @access Public
 */
router.post("/", contactFormValidation, submitContactForm);

module.exports = router;
