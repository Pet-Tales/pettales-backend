const express = require("express");
const router = express.Router();
const luluWebhookController = require("../controllers/luluWebhookController");
const rateLimit = require("express-rate-limit");

// Rate limiting for webhook endpoints
const webhookRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: {
    success: false,
    message: "Too many webhook requests from this IP, please try again later.",
  },
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Middleware to capture raw body for signature verification
 * According to Lulu docs: "To validate HMAC, it should be calculated using raw response data -
 * parsing it to JSON can cause formatting issues."
 */
const captureRawBody = (req, res, next) => {
  let rawBody = '';

  req.on('data', (chunk) => {
    rawBody += chunk.toString();
  });

  req.on('end', () => {
    req.rawBody = rawBody;
    next();
  });
};

/**
 * @route POST /api/webhooks/lulu/print-job-status
 * @desc Handle Lulu print job status change webhook
 * @access Public (but secured with HMAC signature)
 *
 * According to Lulu docs:
 * - Webhook submissions are retried 5 times on failure
 * - After 5 failed submissions in a row, webhook is deactivated
 * - HMAC signature is sent in Lulu-HMAC-SHA256 header
 */
router.post(
  "/print-job-status",
  express.raw({ type: 'application/json' }), // Capture raw body for signature verification
  webhookRateLimit,
  (req, res, next) => {
    // Convert raw buffer to string and parse JSON for processing
    req.rawBody = req.body.toString();
    try {
      req.body = JSON.parse(req.rawBody);
      next();
    } catch (error) {
      return res.status(400).json({
        success: false,
        message: "Invalid JSON payload",
      });
    }
  },
  luluWebhookController.handlePrintJobStatusChange
);

module.exports = router;
