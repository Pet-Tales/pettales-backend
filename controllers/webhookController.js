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
    return true; // Allow webhook if no secret is configured
  }

  if (!signature) {
    logger.warn("No webhook signature provided");
    return false;
  }

  // Extract the signature (remove 'sha256=' prefix)
  const providedSignature = signature.replace("sha256=", "");

  // Calculate expected signature
  const expectedSignature = crypto
    .createHmac("sha256", WEBHOOK_SECRET)
    .update(payload)
    .digest("hex");

  // Use crypto.timingSafeEqual to prevent timing attacks
  const providedBuffer = Buffer.from(providedSignature, "hex");
  const expectedBuffer = Buffer.from(expectedSignature, "hex");

  if (providedBuffer.length !== expectedBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(providedBuffer, expectedBuffer);
};

/**
const handleBookGeneration = async (req, res) => {
  try {
    // (Optional) keep this block only if you actually set WEBHOOK_SECRET and sign requests.
    const signature = req.headers["x-webhook-signature"];
    if (!verifyWebhookSignature(JSON.stringify(req.body), signature)) {
      return res.status(401).json({ success: false, message: "Invalid signature" });
    }

    // Basic payload validation
    const errors = validationResult(req);
    if (!errors || !errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array ? errors.array() : [] });
    }

    const { bookId, status, message, pdf_url } = req.body;
    if (!bookId) {
      return res.status(400).json({ success: false, message: "Missing bookId" });
    }

    // Load book + user
    const book = await Book.findById(bookId).populate("user_id");
    if (!book) {
      return res.status(404).json({ success: false, message: "Book not found" });
    }
    const user = book.user_id;
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found for this book" });
    }

    // --- Persist status so UI doesn't stay stuck on "generating"
    const update = {
      generation_status: status === 200 ? "success" : "failed",
      updated_at: new Date(),
    };
    if (pdf_url) update.pdf_url = pdf_url; // save PDF URL if your webhook provides it

    const updatedBook = await Book.findByIdAndUpdate(
      bookId,
      { $set: update },
      { new: true }
    );

    // --- Optional: notifications (safe-guarded; skip if your email service uses different names)
    try {
      if (status === 200 && emailService?.sendBookReadyEmail) {
        await emailService.sendBookReadyEmail(user.email, updatedBook);
      } else if (status !== 200 && emailService?.sendBookFailedEmail) {
        await emailService.sendBookFailedEmail(user.email, updatedBook, message || "Story generation failed");
      }
    } catch (notifyErr) {
      logger.warn("Email notification failed:", notifyErr);
    }

    return res.json({
      success: true,
      message: "Webhook processed",
      bookId,
      generation_status: updatedBook.generation_status,
    });
  } catch (error) {
    logger.error("Webhook processing error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

module.exports = {
  handleBookGeneration,
};
