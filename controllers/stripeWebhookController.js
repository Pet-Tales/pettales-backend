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
        expand: ["customer]()
