const stripe = require("stripe");
const { STRIPE_SECRET_KEY, WEB_URL } = require("../utils/constants");
const logger = require("../utils/logger");

// Initialize Stripe
const stripeClient = stripe(STRIPE_SECRET_KEY);

class StripeService {
  /**
   * Create a generic Stripe checkout session (for book purchases)
   * @param {string} userId - User ID
   * @param {number} priceInCents - Price in cents
   * @param {string} userEmail - User email for prefilling
   * @param {string} context - Purchase context ('book-download', 'book-print', etc.)
   * @param {Object} metadata - Additional metadata for the session
   * @returns {Promise<Object>} - Stripe checkout session
   */
  async createCheckoutSession(
    userId,
    priceInCents,
    userEmail,
    context = "book-download",
    metadata = {}
  ) {
    try {
      logger.info(
        `Creating checkout session: $${(priceInCents / 100).toFixed(
          2
        )} for context: ${context}`
      );

      // Determine URLs based on context
      let successUrl, cancelUrl;
      const bookId = metadata.bookId || metadata.book_id;
      const returnUrl = metadata.returnUrl || `/books/${bookId}`;
      
      if (context === "book-download" || context === "book-print") {
        successUrl = `${WEB_URL}${returnUrl}?payment=success&session_id={CHECKOUT_SESSION_ID}`;
        cancelUrl = `${WEB_URL}${returnUrl}?payment=cancelled`;
      } else {
        // Fallback for any other context
        successUrl = `${WEB_URL}/success?session_id={CHECKOUT_SESSION_ID}`;
        cancelUrl = `${WEB_URL}/cancelled`;
      }

      // Determine product name based on context
      let productName, productDescription;
      if (context === "book-download") {
        productName = `Digital Book Download (${metadata.page_count || 12} pages)`;
        productDescription = "Instant PDF download of your personalized children's book";
      } else if (context === "book-print") {
        productName = `Print & Ship Book (${metadata.page_count || 12} pages)`;
        productDescription = "Professional printed book shipped to your address (includes digital download)";
      } else {
        productName = "PetTalesAI Purchase";
        productDescription = "Purchase from PetTalesAI";
      }

      // Create checkout session
      const session = await stripeClient.checkout.sessions.create({
        payment_method_types: ["card"],
        line_items: [
          {
            price_data: {
              currency: "usd",
              product_data: {
                name: productName,
                description: productDescription,
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
          type: context,
          ...metadata,
        },
        payment_intent_data: {
          metadata: {
            user_id: userId,
            type: context,
            ...metadata,
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
   * Retrieve a checkout session by ID (alias for retrieveSession)
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
   * Check if a checkout session was completed successfully for a book
   * @param {string} sessionId - Stripe session ID
   * @param {string} bookId - Book ID to verify
   * @returns {Promise<boolean>} - True if session was completed for this book
   */
  async isSessionCompletedForBook(sessionId, bookId) {
    try {
      const session = await this.getCheckoutSession(sessionId);

      return (
        session.payment_status === "paid" &&
        (session.metadata?.type === "book-download" ||
          session.metadata?.type === "book-print" ||
          session.metadata?.type === "pdf_download") &&
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
