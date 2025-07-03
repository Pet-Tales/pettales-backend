const express = require('express');
const { body } = require('express-validator');
const { webhookController } = require('../controllers');
const { webhookRateLimit } = require('../middleware');

const router = express.Router();

// Validation rules for book generation webhook
const bookGenerationValidation = [
  body('bookId')
    .isMongoId()
    .withMessage('Book ID must be a valid MongoDB ObjectId'),
  body('status')
    .isInt({ min: 100, max: 599 })
    .withMessage('Status must be a valid HTTP status code'),
  body('message')
    .optional()
    .isString()
    .trim()
    .withMessage('Message must be a string'),
  body('timestamp')
    .isISO8601()
    .withMessage('Timestamp must be a valid ISO 8601 date'),
];

// Book generation webhook endpoint
router.post(
  '/book-generation',
  webhookRateLimit, // Apply rate limiting
  bookGenerationValidation,
  webhookController.handleBookGeneration
);

module.exports = router;
