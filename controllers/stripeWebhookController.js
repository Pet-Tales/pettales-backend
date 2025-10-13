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
        await bookPurchaseService.processBookPurchase(session);
      } catch (err) {
        logger.error(`Error processing print order session: ${err.stack || err.message}`);
      }
    }
  } catch (err) {
    logger.error(`Error handling checkout session completed: ${err.stack || err.message}`);
  }
};

/**
 * Handle payment intent succeeded
 */
const handlePaymentIntentSucceeded = async (paymentIntent) => {
  logger.info(`PaymentIntent succeeded: ${paymentIntent.id}`);
  // Additional logic if needed
};

/**
 * Handle payment intent failed
 */
const handlePaymentIntentFailed = async (paymentIntent) => {
  logger.warn(`PaymentIntent failed: ${paymentIntent.id}`);
  // Additional logic if needed
};

module.exports = { handleStripeWebhook };
