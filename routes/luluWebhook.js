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
 * @route POST /api/webhooks/lulu/print-job-status
 * @desc Handle Lulu print job status change webhook
 * @access Public (but secured with HMAC signature)
 */
router.post(
  "/print-job-status",
  webhookRateLimit,
  luluWebhookController.handlePrintJobStatusChange
);

module.exports = router;
