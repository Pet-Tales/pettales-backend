const Stripe = require("stripe");
const logger = require("../utils/logger");
const { STRIPE_SECRET_KEY } = require("../utils/constants");

const stripe = new Stripe(STRIPE_SECRET_KEY);

class StripeService {
  /**
   * Create a payment intent
   */
  async createPaymentIntent(amount, currency = "GBP", metadata = {}) {
    try {
      const paymentIntent = await stripe.paymentIntents.create({
        amount,
        currency,
        metadata,
      });

      logger.info(`PaymentIntent created: ${paymentIntent.id}`);
      return paymentIntent;
    } catch (error) {
      logger.error("Error creating payment intent", error);
      throw new Error("Error creating payment intent");
    }
  }

  /**
   * Retrieve a payment intent by ID
   */
  async retrievePaymentIntent(paymentIntentId) {
    try {
      const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
      return paymentIntent;
    } catch (error) {
      logger.error(`Error retrieving payment intent ${paymentIntentId}`, error);
      throw new Error("Error retrieving payment intent");
    }
  }

  /**
   * Capture a payment intent
   */
  async capturePaymentIntent(paymentIntentId) {
    try {
      const paymentIntent = await stripe.paymentIntents.capture(paymentIntentId);
      logger.info(`PaymentIntent captured: ${paymentIntent.id}`);
      return paymentIntent;
    } catch (error) {
      logger.error(`Error capturing payment intent ${paymentIntentId}`, error);
      throw new Error("Error capturing payment intent");
    }
  }
}

module.exports = new StripeService();
