const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const logger = require("../utils/logger");
const printOrderService = require("../services/printOrderService");
const { buffer } = require("micro"); // ensure body is not parsed

module.exports.handleStripeWebhook = async (req, res) => {
  try {
    const sig = req.headers["stripe-signature"];
    const buf = await buffer(req);
    let event;

    try {
      event = stripe.webhooks.constructEvent(
        buf,
        sig,
        process.env.STRIPE_WEBHOOK_SECRET
      );
    } catch (err) {
      logger.error("Webhook signature verification failed:", err.message);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    logger.info(`Received Stripe event: ${event.type}`);

    if (event.type === "checkout.session.completed") {
      const session = event.data.object;
      logger.info("Stripe session metadata:", session.metadata);

      try {
        await printOrderService.createPrintOrder({
          stripe_session_id: session.id,
          payment_intent_id: session.payment_intent,
          user_id: session.metadata.user_id,
          book_id: session.metadata.book_id,
          shipping_address: {
            email: session.customer_details?.email || session.metadata.email,
            phone_number:
              session.customer_details?.phone ||
              session.metadata.phone_number,
            postcode: session.metadata.postcode,
            street1: session.metadata.street1,
          },
          lulu_cost_usd: session.metadata.lulu_cost_usd,
          total_cost_credits: session.metadata.total_cost_credits,
        });

        logger.info("✅ Print order successfully created from webhook");
      } catch (err) {
        logger.error("❌ Failed to process Lulu print order:", err);
      }
    }

    res.status(200).send("ok");
  } catch (error) {
    logger.error("Stripe webhook error:", error.message);
    res.status(500).send("Webhook handler failed");
  }
};
