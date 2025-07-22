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
   * @param {string} context - Purchase context ('pricing', 'book-creation', or 'pdf-download')
   * @param {Object} metadata - Additional metadata for the session
   * @returns {Promise<Object>} - Stripe checkout session
   */
  async createCreditPurchaseSession(
    userId,
    creditAmount,
    userEmail,
    context = "pricing",
    metadata = {}
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
      } else if (context === "pdf-download") {
        // For PDF downloads, redirect back to the book page with download trigger
        const bookId = metadata.bookId;
        const returnUrl = metadata.returnUrl || `/books/${bookId}`;
        successUrl = `${WEB_URL}${returnUrl}?payment=success&download=pdf&session_id={CHECKOUT_SESSION_ID}`;
        cancelUrl = `${WEB_URL}${returnUrl}?payment=cancelled`;
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
        ...(userEmail && { customer_email: userEmail }),
        metadata: {
          user_id: userId,
          credit_amount: creditAmount.toString(),
          type: context === "pdf-download" ? "pdf_download" : "credit_purchase",
          context: context,
          ...(metadata.bookId && { book_id: metadata.bookId }),
          ...(metadata.returnUrl && { return_url: metadata.returnUrl }),
        },
        payment_intent_data: {
          metadata: {
            user_id: userId,
            credit_amount: creditAmount.toString(),
            type:
              context === "pdf-download" ? "pdf_download" : "credit_purchase",
            context: context,
            ...(metadata.bookId && { book_id: metadata.bookId }),
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
   * Retrieve a checkout session by ID
   * @param {string} sessionId - Stripe session ID
   * @returns {Promise<Object>} - Stripe session object
   */
  async getCheckoutSession(sessionId) {
    try {
      const session = await stripeClient.checkout.sessions.retrieve(sessionId);
      return session;
    } catch (error) {
      logger.error(`Failed to retrieve checkout session: ${error.message}`);
      throw new Error("Session retrieval failed: " + error.message);
    }
  }

  /**
   * Check if a checkout session was completed successfully for PDF download
   * @param {string} sessionId - Stripe session ID
   * @param {string} bookId - Book ID to verify
   * @returns {Promise<boolean>} - True if session was completed for this book
   */
  async isSessionCompletedForBook(sessionId, bookId) {
    try {
      const session = await this.getCheckoutSession(sessionId);

      return (
        session.payment_status === "paid" &&
        session.metadata?.type === "pdf_download" &&
        session.metadata?.book_id === bookId
      );
    } catch (error) {
      logger.error(`Failed to verify session for book: ${error.message}`);
      return false;
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
