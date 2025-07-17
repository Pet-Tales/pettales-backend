const { validationResult } = require("express-validator");

const {
  authenticateUser,
  requireAuth,
  requireEmailVerification,
  requireGuest,
} = require("./auth");

const { webhookRateLimit, strictWebhookRateLimit } = require("./rateLimiting");

/**
 * Handle validation errors from express-validator
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: "Validation failed",
      errors: errors.array(),
    });
  }
  next();
};

module.exports = {
  authenticateUser,
  requireAuth,
  requireEmailVerification,
  requireGuest,
  webhookRateLimit,
  strictWebhookRateLimit,
  handleValidationErrors,
};
