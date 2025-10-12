// controllers/stripeWebhookController.js
const Stripe = require("stripe");
const logger = require("../utils/logger");
const {
  STRIPE_SECRET_KEY,
} = require("../utils/constants");
const printOrderService = require("../services/printOrderService");

// Important: index.js must use express.raw({ type: 'application/json' }) for this route
const stripe = new Stripe(STRIPE_SECRET_KEY, { apiVersion: "2024-06-20" });

/**
 * Stripe webhook handler
 * Expects raw buffer body and `stripe-signature` header set by Stripe.
 */
const handleStripeWebhook = async (req, res) => {
  let event;

  try {
    const signature = req.headers["stripe-signature"];
    if (!signature) {
      logger.error("Stripe webhook: Missing stripe-signature header");
      return res.status(400).send("Missing Stripe signature");
    }

    // NOTE: req.body must be a Buffer (express.raw)
    event = stripe.webhooks.constructEvent(
      req.body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    logger.error(`Stripe webhook signature verification failed: ${err.message}`);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    logger.info(`🔔 Stripe event received: ${event.type}`);

    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object;

        // We only process our print orders (guard via metadata.type)
        const meta = session.metadata || {};
        if (meta.type === "book_print") {
          logger.info(
            `Stripe webhook: print order payment completed for session ${session.id}, book ${meta.book_id}`
          );
          await printOrderService.processPrintPaymentSuccess(session);
        } else {
          logger.info(
            `Stripe webhook: checkout.session.completed ignored (type=${meta.type || "n/a"})`
          );
        }
        break;
      }

      // Optional: react to payment_intent.succeeded if you use Payment Intents directly
      case "payment_intent.succeeded": {
        // no-op for now; we rely on Checkout Session above
        break;
      }

      default:
        // Intentionally ignore other events
        break;
    }

    return res.json({ received: true });
  } catch (err) {
    logger.error(`Stripe webhook processing error: ${err.stack || err.message}`);
    return res.status(500).send("Webhook handler failed");
  }
};

module.exports = {
  handleStripeWebhook,
};
