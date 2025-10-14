const crypto = require("crypto");
const { validationResult } = require("express-validator");
const logger = require("../utils/logger");
const { emailService } = require("../services");
const { Book } = require("../models");
const { WEBHOOK_SECRET } = require("../utils/constants");

/**
 * Verify webhook signature
 * @param {string} payload - Raw payload string
 * @param {string} signature - Signature from X-Webhook-Signature header
 * @returns {boolean} - Whether signature is valid
 */
const verifyWebhookSignature = (payload, signature) => {
  if (!WEBHOOK_SECRET) {
    logger.warn(
      "Webhook secret not configured, skipping signature verification"
    );
    return true;
  }

  if (!signature) {
    logger.warn("No webhook signature provided");
    return false;
  }

  const providedSignature = signature.replace("sha256=", "");

  const expectedSignature = crypto
    .createHmac("sha256", WEBHOOK_SECRET)
    .update(payload)
    .digest("hex");

  const providedBuffer = Buffer.from(providedSignature, "hex");
  const expectedBuffer = Buffer.from(expectedSignature, "hex");

  if (providedBuffer.length !== expectedBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(providedBuffer, expectedBuffer);
};

/**
 * Handle book generation webhook notifications
 */
const handleBookGeneration = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      logger.warn("Webhook validation failed", { errors: errors.array() });
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: errors.array(),
      });
    }

    const signature = req.get("X-Webhook-Signature");
    const rawPayload = JSON.stringify(req.body);

    if (!verifyWebhookSignature(rawPayload, signature)) {
      logger.warn("Webhook signature verification failed", {
        ip: req.ip,
        userAgent: req.get("User-Agent"),
      });
      return res.status(401).json({
        success: false,
        message: "Invalid webhook signature",
      });
    }

    const { bookId, status, message, timestamp } = req.body;

    logger.info(`Received webhook for book ${bookId} with status ${status}`, {
      bookId,
      status,
      message,
      timestamp,
      ip: req.ip,
    });

    const book = await Book.findById(bookId).populate("user_id");
    if (!book) {
      logger.warn(`Book not found for webhook: ${bookId}`);
      return res.status(404).json({
        success: false,
        message: "Book not found",
      });
    }

    const user = book.user_id;
    if (!user) {
      logger.warn(`User not found for book: ${bookId}`);
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // REMOVED: Credit refund logic (credit system no longer exists)

    try {
      if (status === 200) {
        await emailService.sendBookGenerationSuccess(
          user.email,
          user.first_name || "User",
          book.title,
          book.pdf_url,
          user.preferred_language || "en"
        );
        logger.info(`Sent success email for book ${bookId} to ${user.email}`);
      } else {
        await emailService.sendBookGenerationFailure(
          user.email,
          user.first_name || "User",
          book.title,
          user.preferred_language || "en"
        );
        logger.info(`Sent failure email for book ${bookId} to ${user.email}`);
      }
    } catch (emailError) {
      logger.error(
        `Failed to send email notification for book ${bookId}:`,
        emailError
      );
    }

    res.json({
      success: true,
      message: "Webhook processed successfully",
      received: true,
    });
