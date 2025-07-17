const rateLimit = require("express-rate-limit");
const logger = require("../utils/logger");

/**
 * Rate limiting middleware for webhook endpoints
 * Prevents abuse by limiting the number of requests per IP
 */
const webhookRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 500, // Limit each IP to 100 requests per windowMs
  message: {
    success: false,
    message: "Too many webhook requests from this IP, please try again later.",
    code: "RATE_LIMIT_EXCEEDED",
  },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  handler: (req, res) => {
    logger.warn(`Webhook rate limit exceeded for IP: ${req.ip}`, {
      ip: req.ip,
      userAgent: req.get("User-Agent"),
      endpoint: req.originalUrl,
    });

    res.status(429).json({
      success: false,
      message:
        "Too many webhook requests from this IP, please try again later.",
      code: "RATE_LIMIT_EXCEEDED",
    });
  },
  skip: (req) => {
    // Skip rate limiting in development mode for easier testing
    const { DEBUG_MODE } = require("../utils/constants");
    return DEBUG_MODE && req.ip === "127.0.0.1";
  },
});

/**
 * More restrictive rate limiting for sensitive webhook operations
 */
const strictWebhookRateLimit = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 100, // Limit each IP to 20 requests per 5 minutes
  message: {
    success: false,
    message: "Too many requests from this IP, please try again later.",
    code: "RATE_LIMIT_EXCEEDED",
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    logger.warn(`Strict webhook rate limit exceeded for IP: ${req.ip}`, {
      ip: req.ip,
      userAgent: req.get("User-Agent"),
      endpoint: req.originalUrl,
    });

    res.status(429).json({
      success: false,
      message: "Too many requests from this IP, please try again later.",
      code: "RATE_LIMIT_EXCEEDED",
    });
  },
  skip: (req) => {
    // Skip rate limiting in development mode for easier testing
    const { DEBUG_MODE } = require("../utils/constants");
    return DEBUG_MODE && req.ip === "127.0.0.1";
  },
});

module.exports = {
  webhookRateLimit,
  strictWebhookRateLimit,
};
