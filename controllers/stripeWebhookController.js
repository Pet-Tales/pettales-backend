const stripeService = require("../services/stripeService");
const creditService = require("../services/creditService");
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
    // Check if this is a credit purchase or PDF download
    if (
      session.metadata?.type !== "credit_purchase" &&
      session.metadata?.type !== "pdf_download"
    ) {
      logger.info(`Ignoring non-credit purchase session: ${session.id}`);
      return;
    }

    const userId = session.metadata.user_id;
    const creditAmount = parseInt(session.metadata.credit_amount);
    const sessionType = session.metadata.type;

    if (!userId || !creditAmount) {
      logger.error(
        `Invalid session metadata: ${JSON.stringify(session.metadata)}`
      );
      return;
    }

    // For PDF downloads (both guests and authenticated users), we don't need to add credits
    // The payment success is handled by the frontend redirect and session verification
    if (sessionType === "pdf_download") {
      logger.info(
        `PDF download payment completed for session: ${session.id} (user: ${userId})`
      );
      return;
    }

    // Check if payment was successful
    if (session.payment_status === "paid") {
      // Check if credits have already been added for this payment intent
      const { CreditTransaction } = require("../models");
      const existingTransaction = await CreditTransaction.findOne({
        stripe_payment_intent_id: session.payment_intent,
        type: "purchase",
      });

      if (existingTransaction) {
        logger.info(
          `Credits already added for payment intent ${session.payment_intent} via webhook`
        );
        return;
      }

      // Add credits to user account
      await creditService.addCredits(
        userId,
        creditAmount,
        `Purchased ${creditAmount} credits via Stripe (Session: ${session.id})`,
        {
          paymentIntentId: session.payment_intent,
          invoiceId: session.invoice,
        }
      );

      logger.info(
        `Successfully processed credit purchase for user ${userId}: ${creditAmount} credits`
      );
    } else {
      logger.warn(
        `Checkout session completed but payment not successful: ${session.id}, status: ${session.payment_status}`
      );
    }
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
    // Check if this is a credit purchase or PDF download
    if (
      paymentIntent.metadata?.type !== "credit_purchase" &&
      paymentIntent.metadata?.type !== "pdf_download"
    ) {
      logger.info(
        `Ignoring non-credit purchase payment intent: ${paymentIntent.id}`
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
    // Check if this is a credit purchase
    if (paymentIntent.metadata?.type !== "credit_purchase") {
      logger.info(
        `Ignoring non-credit purchase payment intent: ${paymentIntent.id}`
      );
      return;
    }

    const userId = paymentIntent.metadata.user_id;
    const creditAmount = paymentIntent.metadata.credit_amount;

    logger.warn(
      `Payment failed for user ${userId}: ${creditAmount} credits, payment intent: ${paymentIntent.id}`
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
