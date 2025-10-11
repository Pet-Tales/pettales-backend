const Stripe = require("stripe");
const { Readable } = require("stream");
const logger = require("../utils/logger");
const { STRIPE_SECRET_KEY } = require("../utils/constants");

const stripe = new Stripe(STRIPE_SECRET_KEY);

/**
 * Convert the raw incoming request body into a buffer.
 * This replaces the old `micro` body parser and allows Stripe
 * to verify the webhook signature properly.
 */
const bufferFromRequest = async (req) => {
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
};

/**
 * Handle Stripe webhook events
 */
exports.handleStripeWebhook = async (req, res) => {
  try {
    const sig = req.headers["stripe-signature"];
    const buf = await bufferFromRequest(req);

    // Verify Stripe signature
    const event = stripe.webhooks.constructEvent(
      buf,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );

    logger.info(`✅ Stripe event received: ${event.type}`);

    // Handle event types
    if (event.type === "checkout.session.completed") {
      const session = event.data.object;
      logger.info(`💳 Checkout session completed for ${session.id}`);
      // TODO: trigger your Lulu print order or email generation here
    } else if (event.type === "payment_intent.succeeded") {
      logger.info(`💰 Payment succeeded: ${event.data.object.id}`);
    } else {
      logger.info(`Unhandled event type: ${event.type}`);
    }

    res.status(200).send("OK");
  } catch (err) {
    logger.error(`❌ Stripe webhook error: ${err.message}`);
    res.status(400).send(`Webhook Error: ${err.message}`);
  }
};
