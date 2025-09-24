const stripe = require("stripe");
const { 
  STRIPE_SECRET_KEY, 
  WEB_URL,
  STRIPE_PRICE_DOWNLOAD_12,
  STRIPE_PRICE_DOWNLOAD_16,
  STRIPE_PRICE_DOWNLOAD_24,
} = require("../utils/constants");
const logger = require("../utils/logger");

// Initialize Stripe
const stripeClient = stripe(STRIPE_SECRET_KEY);

class StripeService {
 /**
   * Get the price ID for a download based on page count
   */
  getDownloadPriceId(pageCount) {
    const priceMap = {
      12: STRIPE_PRICE_DOWNLOAD_12,
      16: STRIPE_PRICE_DOWNLOAD_16,
      24: STRIPE_PRICE_DOWNLOAD_24,
    };
    return priceMap[pageCount] || STRIPE_PRICE_DOWNLOAD_12;
  }

  /**
   * Create a Stripe checkout session for book downloads (using product IDs)
   * @param {string} bookId - Book ID
   * @param {number} pageCount - Number of pages (12, 16, or 24)
   * @param {string} userId - User ID
   * @param {string} userEmail - User email for prefilling
   * @param {Object} metadata - Additional metadata
   * @returns {Promise<Object>} - Stripe checkout session
   */
  async createDownloadCheckoutSession(bookId, pageCount, userId, userEmail, metadata = {}) {
    try {
      const priceId = this.getDownloadPriceId(pageCount);
      
      logger.info(
        `Creating download checkout session for book ${bookId}, ${pageCount} pages`
      );

      const returnUrl = metadata.returnUrl || `/books/${bookId}`;
      
      // Create checkout session with product ID
      const session = await stripeClient.checkout.sessions.create({
        payment_method_types: ["card"],
        line_items: [
          {
            price: productId, // Using product ID directly - Stripe will use its default price
            quantity: 1,
          },
        ],
        mode: "payment",
        success_url: `${WEB_URL}${returnUrl}?payment=success&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${WEB_URL}${returnUrl}?payment=cancelled`,
        ...(userEmail && { customer_email: userEmail }),
        metadata: {
          type: "book_download",
          book_id: bookId,
          user_id: userId || `guest_${Date.now()}`,
          page_count: pageCount.toString(),
          ...metadata,
        },
        payment_intent_data: {
          metadata: {
            type: "book_download",
            book_id: bookId,
            user_id: userId || `guest_${Date.now()}`,
            page_count: pageCount.toString(),
          },
        },
      });

      logger.info(
        `Created download checkout session for user ${userId}: ${session.id}`
      );
      return session;
    } catch (error) {
      logger.error(
        `Failed to create download checkout session: ${error.message}`
      );
      throw new Error(`Download checkout session creation failed: ${error.message}`);
    }
  }

  /**
   * Create a Stripe checkout session for print orders (dynamic pricing)
   * @param {string} bookId - Book ID
   * @param {number} totalCents - Total price in cents (Lulu cost + markup)
   * @param {string} userId - User ID
   * @param {string} userEmail - User email
   * @param {Object} metadata - Additional metadata (should include shipping info)
   * @returns {Promise<Object>} - Stripe checkout session
   */
  async createPrintCheckoutSession(bookId, totalCents, userId, userEmail, metadata = {}) {
    try {
      logger.info(
        `Creating print checkout session: $${(totalCents / 100).toFixed(2)} for book ${bookId}`
      );

      const returnUrl = metadata.returnUrl || `/books/${bookId}`;
      const pageCount = metadata.page_count || metadata.pageCount || 12;
      
      // Create checkout session with dynamic pricing
      const session = await stripeClient.checkout.sessions.create({
        payment_method_types: ["card"],
        line_items: [
          {
            price_data: {
              currency: "usd",
              product_data: {
                name: `Print & Ship - ${pageCount} Page Book`,
                description: `Professional printed book shipped to ${metadata.shipping_country || 'your address'}. Includes digital download.`,
              },
              unit_amount: totalCents,
            },
            quantity: 1,
          },
        ],
        mode: "payment",
        success_url: `${WEB_URL}${returnUrl}?payment=success&print=true&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${WEB_URL}${returnUrl}?payment=cancelled`,
        ...(userEmail && { customer_email: userEmail }),
        metadata: {
          type: "book_print",
          book_id: bookId,
          user_id: userId || `guest_${Date.now()}`,
          page_count: pageCount.toString(),
          lulu_print_cost: metadata.lulu_print_cost,
          lulu_shipping_cost: metadata.lulu_shipping_cost,
          print_markup: metadata.print_markup,
          shipping_markup: metadata.shipping_markup,
          ...metadata,
        },
        payment_intent_data: {
          metadata: {
            type: "book_print",
            book_id: bookId,
            user_id: userId || `guest_${Date.now()}`,
          },
        },
      });

      logger.info(
        `Created print checkout session for user ${userId}: ${session.id}`
      );
      return session;
    } catch (error) {
      logger.error(
        `Failed to create print checkout session: ${error.message}`
      );
      throw new Error(`Print checkout session creation failed: ${error.message}`);
    }
  }

  /**
   * Create a generic checkout session (for backwards compatibility and special cases)
   * @param {string} userId - User ID
   * @param {number} priceInCents - Price in cents
   * @param {string} userEmail - User email for prefilling
   * @param {string} context - Purchase context
   * @param {Object} metadata - Additional metadata
   * @returns {Promise<Object>} - Stripe checkout session
   */
  async createCheckoutSession(userId, priceInCents, userEmail, context = "book-download", metadata = {}) {
    try {
      // Route to specific methods based on context
      if (context === "book-download") {
        const pageCount = metadata.page_count || 12;
        const bookId = metadata.bookId || metadata.book_id;
        return this.createDownloadCheckoutSession(bookId, pageCount, userId, userEmail, metadata);
      } else if (context === "book-print") {
        const bookId = metadata.bookId || metadata.book_id;
        return this.createPrintCheckoutSession(bookId, priceInCents, userId, userEmail, metadata);
      }

      // Fallback for other contexts (charity donations, etc.)
      logger.info(
        `Creating generic checkout session: $${(priceInCents / 100).toFixed(2)} for context: ${context}`
      );

      const bookId = metadata.bookId || metadata.book_id;
      const returnUrl = metadata.returnUrl || `/books/${bookId}`;
      
      const session = await stripeClient.checkout.sessions.create({
        payment_method_types: ["card"],
        line_items: [
          {
            price_data: {
              currency: "usd",
              product_data: {
                name: metadata.productName || "PetTalesAI Purchase",
                description: metadata.productDescription || "Purchase from PetTalesAI",
              },
              unit_amount: priceInCents,
            },
            quantity: 1,
          },
        ],
        mode: "payment",
        success_url: `${WEB_URL}${returnUrl}?payment=success&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${WEB_URL}${returnUrl}?payment=cancelled`,
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
        `Created generic checkout session for user ${userId}: ${session.id}`
      );
      return session;
    } catch (error) {
      logger.error(
        `Failed to create checkout session: ${error.message}`
      );
      throw new Error(`Checkout session creation failed: ${error.message}`);
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
        (session.metadata?.type === "book_download" ||
          session.metadata?.type === "book_print" ||
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
