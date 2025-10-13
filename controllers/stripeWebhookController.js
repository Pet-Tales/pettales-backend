const stripeService = require("../services/stripeService");
const bookPurchaseService = require("../services/bookPurchaseService");
const printOrderService = require("../services/printOrderService");
const logger = require("../utils/logger");

/**
 * Handle Stripe webhook events
 * @route POST /api/webhook/stripe
 * @access Public (but verified via Stripe signature)
 */
const handleStripeWebhook = async (req, res) => {
  try {
    const signature = req.headers["stripe-signature"];
    const payload = req.body;

    // Verify webhook signature
    const event = stripeService.constructWebhookEvent(payload, signature);

    logger.info(`Received Stripe webhook event: ${event.type}`);

    // Handle different event types
    switch (event.type) {
      case "checkout.session.completed":
        await handleCheckoutSessionCompleted(event.data.object);
        break;

      case "payment_intent.succeeded":
        await handlePaymentIntentSucceeded(event.data.object);
        break;

      case "payment_intent.payment_failed":
        await handlePaymentIntentFailed(event.data.object);
        break;

      default:
        logger.info(`Unhandled Stripe webhook event type: ${event.type}`);
    }

    res.status(200).json({ received: true });
  } catch (error) {
    logger.error(`Stripe webhook error: ${error.message}`);
    res.status(400).json({
      success: false,
      message: "Webhook processing failed",
      error: error.message,
    });
  }
};

/**
 * Handle successful checkout session completion
 * @param {Object} session - Stripe checkout session object
 */
const handleCheckoutSessionCompleted = async (session) => {
  try {
    const sessionType = session.metadata?.type;
    
    // Handle print orders (new)
    if (sessionType === "book_print") {
      try {
        // Process print order creation
        await printOrderService.processPrintPaymentSuccess(session);
        
        // Also process as book purchase for the download entitlement
        await bookPurchaseService.processPaymentSuccess(session);
        
        logger.info(
          `Print order processed for session: ${session.id}`
        );
      } catch (e) {
        logger.error(`Failed to process print order: ${e.message}`);
      }
      return;
    }
    
    // Handle book downloads (existing system)
    if (sessionType === "book_download") {
      try {
        await bookPurchaseService.processPaymentSuccess(session);
        logger.info(
          `Book download purchase processed for session: ${session.id}`
        );
      } catch (e) {
        logger.error(`Failed to process book purchase: ${e.message}`);
      }
      return;
    }

    // Handle PDF downloads from gallery (existing charity donation logic)
    if (sessionType === "pdf_download") {
      try {
        // Process as book purchase first
        await bookPurchaseService.processPaymentSuccess(session);
        
        // Then handle charity donation if present
        if (session.metadata?.charity_id) {
          const { CharityDonation } = require("../models");
          const update = {
            status: session.payment_status === "paid" ? "paid" : "failed",
            stripe_payment_intent_id: session.payment_intent,
            amount_cents: session.amount_total || 100,
            currency: session.currency || "usd",
          };
          const base = {
            book_id: session.metadata.book_id || session.metadata.bookId,
            user_id: session.metadata.user_id?.startsWith("guest_") ? null : session.metadata.user_id,
            guest_email: session.customer_details?.email || null,
            charity_id: session.metadata.charity_id,
            stripe_session_id: session.id,
          };
          await CharityDonation.findOneAndUpdate(
            { stripe_session_id: session.id },
            { $setOnInsert: base, $set: update },
            { upsert: true, new: true }
          );
          logger.info(
            `Charity donation recorded for session: ${session.id}`
          );
        }
      } catch (e) {
        logger.error(`Failed to process PDF download: ${e.message}`);
      }
      return;
    }

    // DEPRECATED: Credit purchases - log but ignore
    if (sessionType === "credit_purchase") {
      logger.warn(
        `Received deprecated credit purchase webhook for session: ${session.id}. Ignoring - credit system removed.`
      );
      return;
    }

    logger.info(`Unhandled session type: ${sessionType} for session: ${session.id}`);
  } catch (error) {
    logger.error(`Error handling checkout session completed: ${error.message}`);
    throw error;
  }
};

/**
 * Handle successful payment intent
 * @param {Object} paymentIntent - Stripe payment intent object
 */
const handlePaymentIntentSucceeded = async (paymentIntent) => {
  try {
    // Check if this is a book-related purchase
    const validTypes = ["book_download", "book_print", "pdf_download"];
    if (!validTypes.includes(paymentIntent.metadata?.type)) {
      logger.info(
        `Ignoring non-book purchase payment intent: ${paymentIntent.id}`
      );
      return;
    }

    logger.info(
      `Payment intent succeeded: ${paymentIntent.id} (type: ${paymentIntent.metadata?.type})`
    );
    // Additional processing if needed
  } catch (error) {
    logger.error(`Error handling payment intent succeeded: ${error.message}`);
    throw error;
  }
};

/**
 * Handle failed payment intent
 * @param {Object} paymentIntent - Stripe payment intent object
 */
const handlePaymentIntentFailed = async (paymentIntent) => {
  try {
    // Check if this is a book-related purchase
    const validTypes = ["book_download", "book_print"];
    if (!validTypes.includes(paymentIntent.metadata?.type)) {
      logger.info(
        `Ignoring non-book purchase payment intent: ${paymentIntent.id}`
      );
      return;
    }

    const userId = paymentIntent.metadata.user_id;
    const bookId = paymentIntent.metadata.book_id;

    logger.warn(
      `Payment failed for book ${bookId}, user ${userId}, payment intent: ${paymentIntent.id}`
    );

    // Additional processing for failed payments if needed
    // e.g., send notification email to user
  } catch (error) {
    logger.error(`Error handling payment intent failed: ${error.message}`);
    throw error;
  }
};

module.exports = {
  handleStripeWebhook,
};
