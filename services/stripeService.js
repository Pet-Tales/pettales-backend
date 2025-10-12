// services/stripeService.js
const Stripe = require("stripe");
const {
  STRIPE_SECRET_KEY,
  WEB_URL,
  STRIPE_PRICE_SHORT,
  STRIPE_PRICE_MEDIUM,
  STRIPE_PRICE_LONG,
} = require("../utils/constants");
const logger = require("../utils/logger");

const stripe = new Stripe(STRIPE_SECRET_KEY, { apiVersion: "2024-06-20" });

/**
 * Checkout for fixed-price DOWNLOADS
 * Uses stored Stripe Price IDs (short, medium, long)
 */
async function createCheckoutSession(type, userId, email, metadata = {}) {
  try {
    let priceId;
    if (type === "short") priceId = STRIPE_PRICE_SHORT;
    else if (type === "medium") priceId = STRIPE_PRICE_MEDIUM;
    else if (type === "long") priceId = STRIPE_PRICE_LONG;
    else throw new Error(`Unknown download type: ${type}`);

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      customer_email: email,
      metadata: {
        ...metadata,
        type: "book_download",
        user_id: userId,
      },
      success_url: `${WEB_URL}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${WEB_URL}/cancel`,
    });

    logger.info(`Download checkout session created: ${session.url}`);
    return session.url;
  } catch (err) {
    logger.error(`createCheckoutSession failed: ${err.stack || err.message}`);
    throw err;
  }
}

/**
 * Checkout for dynamically priced PRINT ORDERS
 * Uses Lulu-calculated amount (in cents)
 */
async function createPrintCheckoutSession(
  bookId,
  amount_cents,
  userId,
  email,
  metadata,
  currency = "usd"
) {
  try {
    logger.info(
      `Creating Stripe print checkout for user=${userId}, book=${bookId}, amount=${amount_cents}`
    );

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      customer_email: email,
      line_items: [
        {
          price_data: {
            currency,
            product_data: {
              name: "Pet Tales Printed Book",
              description:
                "Your personalised illustrated story — printed and shipped by Pet Tales",
            },
            unit_amount: amount_cents,
          },
          quantity: 1,
        },
      ],
      metadata: {
        ...metadata,
        type: "book_print",
        user_id: userId,
        book_id: bookId,
      },
      allow_promotion_codes: false,
      shipping_address_collection: {
        allowed_countries: ["GB", "US", "CA", "AU", "IE"],
      },
      success_url: `${WEB_URL}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${WEB_URL}/cancel`,
    });

    logger.info(`Print checkout session created: ${session.url}`);
    return session.url;
  } catch (err) {
    logger.error(
      `createPrintCheckoutSession failed: ${err.stack || err.message}`
    );
    throw err;
  }
}

module.exports = {
  createCheckoutSession,
  createPrintCheckoutSession,
};
