const Stripe = require("stripe");
const logger = require("../utils/logger");
const { STRIPE_SECRET_KEY } = require("../utils/constants");
const { createFromCheckout } = require("../services/stripeToLuluOrder");

const stripe = new Stripe(STRIPE_SECRET_KEY);

const handleStripeWebhook = async (req, res) => {
  try {
    const signature = req.headers["stripe-signature"];
    if (!signature) {
      logger.error("Missing stripe-signature header");
      return res.status(400).send("Missing signature");
    }

    // req.body is a Buffer because of express.raw in index.js
    const event = stripe.webhooks.constructEvent(
      req.body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET
    );

    logger.info(`🔔 Stripe event received: ${event.type}`);

    if (event.type === "checkout.session.completed") {
      const session = event.data.object;

      // Expand to include full details we’ll need for Lulu
      const fullSession = await stripe.checkout.sessions.retrieve(session.id, {
        expand: ["customer_details", "shipping_details", "payment_intent"],
      });

      // 🔹 Create Lulu order
      await createFromCheckout(fullSession);
      logger.info(`✅ Lulu print order triggered for session ${session.id}`);
    } else if (event.type === "payment_intent.succeeded") {
      logger.info(`💰 Payment succeeded: ${event.data.object.id}`);
    } else {
      logger.info(`ℹ️ Unhandled Stripe event type: ${event.type}`);
    }

    return res.status(200).send("OK");
  } catch (err) {
    logger.error(`❌ Stripe webhook error: ${err.message}`);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }
};

module.exports = { handleStripeWebhook };
