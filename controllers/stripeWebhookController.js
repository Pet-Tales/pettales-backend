// controllers/stripeWebhookController.js
const Stripe = require("stripe");
const logger = require("../utils/logger");
const { STRIPE_SECRET_KEY } = require("../utils/constants");
const { createFromCheckout } = require("../services/stripeToLuluOrder");

const stripe = new Stripe(STRIPE_SECRET_KEY, { apiVersion: "2024-06-20" });

/**
 * 🔹 Handles Stripe webhooks for completed checkouts
 */
const handleStripeWebhook = async (req, res) => {
  try {
    const signature = req.headers["stripe-signature"];
    if (!signature) {
      logger.error("Missing stripe-signature header");
      return res.status(400).send("Missing signature");
    }

    const event = stripe.webhooks.constructEvent(
      req.body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET
    );

    logger.info(`🔔 Stripe event received: ${event.type}`);

    if (event.type === "checkout.session.completed") {
      const session = event.data.object;
      const meta = session.metadata || {};

      if (meta.type === "book_print") {
        logger.info(`🧾 Processing paid print order for session ${session.id}`);
        try {
          await createFromCheckout(session, meta);
        } catch (err) {
          logger.error(`❌ Lulu print creation failed: ${err.stack || err.message}`);
        }
      }
    }

    return res.json({ received: true });
  } catch (err) {
    logger.error(`Stripe webhook error: ${err.stack || err.message}`);
    return res.status(500).send("Webhook handler failed");
  }
};

module.exports = { handleStripeWebhook };
