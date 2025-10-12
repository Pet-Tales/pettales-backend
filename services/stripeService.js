// services/stripeService.js
const Stripe = require("stripe");
const { STRIPE_SECRET_KEY, WEB_URL } = require("../utils/constants");
const logger = require("../utils/logger");
const printOrderService = require("./printOrderService");

const stripe = new Stripe(STRIPE_SECRET_KEY, { apiVersion: "2024-06-20" });

/**
 * 🔹 Create a dynamic Stripe checkout for printing based on Lulu cost
 */
async function createPrintCheckoutSession({
  bookId,
  quantity,
  shippingAddress,
  shippingLevel,
  userId,
  email,
}) {
  try {
    // 1️⃣ Get dynamic Lulu cost
    const cost = await printOrderService.calculateOrderCost(
      bookId,
      quantity,
      shippingAddress,
      shippingLevel
    );

    // 2️⃣ Create checkout session charging that exact total
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      customer_email: email,
      line_items: [
        {
          price_data: {
            currency: cost.currency,
            unit_amount: cost.total_cost_cents,
            product_data: {
              name: "Pet Tales — Printed Book",
              description: `Print + shipping (${quantity}x, ${shippingLevel})`,
            },
          },
          quantity: 1,
        },
      ],
      success_url: `${WEB_URL}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${WEB_URL}/cancel`,
      metadata: {
        type: "book_print",
        book_id: String(bookId),
        user_id: String(userId),
        quantity: String(quantity),
        shipping_level: String(shippingLevel),
        ship_country: String(shippingAddress?.country_code || ""),
      },
      shipping_address_collection: {
        allowed_countries: ["GB", "US", "CA", "AU", "IE", "NZ", "FR", "DE"],
      },
    });

    logger.info(`✅ Created Stripe print checkout: ${session.id}`);
    return session;
  } catch (err) {
    logger.error(`createPrintCheckoutSession failed: ${err.stack || err.message}`);
    throw err;
  }
}

module.exports = { createPrintCheckoutSession };
