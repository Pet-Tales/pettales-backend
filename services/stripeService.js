const Stripe = require("stripe");
const logger = require("../utils/logger");
const { STRIPE_SECRET_KEY } = require("../utils/constants");
const printOrderService = require("./printOrderService");

const stripe = new Stripe(STRIPE_SECRET_KEY);

class StripeService {
  async createCheckoutSession(bookId, user, quantity, shippingAddress, shippingLevel) {
    try {
      const cost = await printOrderService.calculateOrderCost(
        bookId,
        quantity,
        shippingAddress,
        shippingLevel
      );

      const session = await stripe.checkout.sessions.create({
        payment_method_types: ["card"],
        line_items: [
          {
            price_data: {
              currency: cost.currency,
              product_data: { name: "Pet Tales Printed Book" },
              unit_amount: cost.total_cost_cents,
            },
            quantity: 1,
          },
        ],
        mode: "payment",
        success_url: `${process.env.WEB_URL}/success`,
        cancel_url: `${process.env.WEB_URL}/cancel`,
        metadata: {
          book_id: bookId,
          user_id: user._id.toString(),
          quantity,
          shipping_level: shippingLevel,
        },
      });

      return session;
    } catch (error) {
      logger.error("Error creating Stripe checkout session:", error.message);
      throw new Error("Failed to create Stripe session");
    }
  }
}

module.exports = new StripeService();
