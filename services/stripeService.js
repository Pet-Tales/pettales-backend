const stripe = require("stripe");
const {
  STRIPE_SECRET_KEY,
  WEB_URL,
  CREDIT_VALUE_USD,
} = require("../utils/constants");
const logger = require("../utils/logger");

// Initialize Stripe
const stripeClient = stripe(STRIPE_SECRET_KEY);

class StripeService {
  /**
   * Create a Stripe checkout session for credit purchase
   * @param {string} userId - User ID
   * @param {number} creditAmount - Number of credits to purchase
   * @param {string} userEmail - User email for prefilling
   * @param {string} context - Purchase context ('pricing' or 'book-creation')
   * @returns {Promise<Object>} - Stripe checkout session
   */
  async createCreditPurchaseSession(
    userId,
    creditAmount,
    userEmail,
    context = "pricing"
  ) {
    try {
      // Calculate price in cents (Stripe uses cents)
      const priceInCents = Math.round(creditAmount * CREDIT_VALUE_USD * 100);

      logger.info(
        `Creating checkout session: ${creditAmount} credits = $${
          creditAmount * CREDIT_VALUE_USD
        } = ${priceInCents} cents for context: ${context}`
      );

      // Determine URLs based on context
      let successUrl, cancelUrl;
      if (context === "book-creation") {
        successUrl = `${WEB_URL}/books/create?payment=success&session_id={CHECKOUT_SESSION_ID}`;
        cancelUrl = `${WEB_URL}/books/create?payment=cancelled`;
      } else {
        successUrl = `${WEB_URL}/credits/success?session_id={CHECKOUT_SESSION_ID}`;
        cancelUrl = `${WEB_URL}/pricing`;
      }

      // Create checkout session
      const session = await stripeClient.checkout.sessions.create({
        payment_method_types: ["card"],
        line_items: [
          {
            price_data: {
              currency: "usd",
              product_data: {
                name: `${creditAmount} PetTalesAI Credits`,
                description: `Purchase ${creditAmount} credits for creating AI-generated children's books`,
              },
              unit_amount: priceInCents,
            },
            quantity: 1,
          },
        ],
        mode: "payment",
        success_url: successUrl,
        cancel_url: cancelUrl,
        customer_email: userEmail,
        metadata: {
          user_id: userId,
          credit_amount: creditAmount.toString(),
          type: "credit_purchase",
        },
        payment_intent_data: {
          metadata: {
            user_id: userId,
            credit_amount: creditAmount.toString(),
            type: "credit_purchase",
          },
        },
      });

      logger.info(
        `Created Stripe checkout session for user ${userId}: ${session.id}`
      );
      return session;
    } catch (error) {
      logger.error(
        `Failed to create Stripe checkout session: ${error.message}`
      );
      throw new Error(`Payment session creation failed: ${error.message}`);
    }
  }

  /**
   * Retrieve a checkout session
   * @param {string} sessionId - Stripe session ID
   * @returns {Promise<Object>} - Stripe session object
   */
  async retrieveSession(sessionId) {
    try {
      const session = await stripeClient.checkout.sessions.retrieve(sessionId);
      return session;
    } catch (error) {
      logger.error(
        `Failed to retrieve Stripe session ${sessionId}: ${error.message}`
      );
      throw new Error(`Session retrieval failed: ${error.message}`);
    }
  }

  /**
   * Retrieve a payment intent
   * @param {string} paymentIntentId - Stripe payment intent ID
   * @returns {Promise<Object>} - Stripe payment intent object
   */
  async retrievePaymentIntent(paymentIntentId) {
    try {
      const paymentIntent = await stripeClient.paymentIntents.retrieve(
        paymentIntentId
      );
      return paymentIntent;
    } catch (error) {
      logger.error(
        `Failed to retrieve payment intent ${paymentIntentId}: ${error.message}`
      );
      throw new Error(`Payment intent retrieval failed: ${error.message}`);
    }
  }

  /**
   * Create a customer in Stripe
   * @param {string} email - Customer email
   * @param {string} name - Customer name
   * @returns {Promise<Object>} - Stripe customer object
   */
  async createCustomer(email, name) {
    try {
      const customer = await stripeClient.customers.create({
        email,
        name,
      });
      return customer;
    } catch (error) {
      logger.error(`Failed to create Stripe customer: ${error.message}`);
      throw new Error(`Customer creation failed: ${error.message}`);
    }
  }

  /**
   * Construct webhook event from request
   * @param {string} payload - Raw request body
   * @param {string} signature - Stripe signature header
   * @returns {Object} - Stripe event object
   */
  constructWebhookEvent(payload, signature) {
    try {
      const event = stripeClient.webhooks.constructEvent(
        payload,
        signature,
        process.env.STRIPE_WEBHOOK_SECRET
      );
      return event;
    } catch (error) {
      logger.error(`Webhook signature verification failed: ${error.message}`);
      throw new Error(`Webhook verification failed: ${error.message}`);
    }
  }
}

module.exports = new StripeService();
