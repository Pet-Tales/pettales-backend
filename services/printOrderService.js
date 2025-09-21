const mongoose = require("mongoose");
const { PrintOrder, Book, User } = require("../models");
const luluService = require("./luluService");
const stripeService = require("./stripeService");
const printReadyPDFService = require("./printReadyPDFService");
const logger = require("../utils/logger");
const { PRINT_MARKUP_PERCENTAGE, SHIPPING_MARKUP_PERCENTAGE } = require("../utils/constants");

class PrintOrderService {
  /**
   * Calculate order cost including markup
   */
  async calculateOrderCost(bookId, quantity, shippingAddress, shippingLevel) {
    try {
      logger.info(
        `Calculating order cost for book ${bookId}, quantity: ${quantity}`
      );

      // Get book details
      const book = await Book.findById(bookId);
      if (!book) {
        throw new Error("Book not found");
      }

      // First, get available shipping options for the destination
      logger.info("Getting available shipping options for destination", {
        country: shippingAddress.country_code,
        requestedShippingLevel: shippingLevel,
      });

      const availableShippingOptions = await luluService.getShippingOptions(
        shippingAddress,
        book.page_count,
        quantity
      );

      // Validate that the requested shipping level is available
      const isShippingLevelAvailable = availableShippingOptions.some(
        (option) => option.level === shippingLevel
      );

      if (!isShippingLevelAvailable) {
        const availableLevels = availableShippingOptions.map(
          (option) => option.level
        );
        logger.error("Requested shipping level not available", {
          requestedLevel: shippingLevel,
          availableLevels,
          country: shippingAddress.country_code,
          totalOptionsFound: availableShippingOptions.length,
        });
        throw new Error(
          `Shipping level "${shippingLevel}" is not available for ${
            shippingAddress.country_code
          }. Available options: ${availableLevels.join(", ") || "None"}`
        );
      }

      // Calculate cost using Lulu API
      logger.info("Calculating cost with validated shipping option", {
        bookPageCount: book.page_count,
        quantity,
        shippingLevel,
        country: shippingAddress.country_code,
      });

      const luluCostData = await luluService.calculatePrintCost(
        book.page_count,
        quantity,
        shippingAddress,
        shippingLevel
      );

      // Calculate costs with markup
      const luluPrintCost = parseFloat(luluCostData.line_item_costs?.[0]?.total_cost_incl_tax || 0);
      const luluShippingCost = parseFloat(luluCostData.shipping_cost?.total_cost_incl_tax || 0);
      const luluTotalCost = parseFloat(luluCostData.total_cost_incl_tax);

      // Apply markups
      const printMarkupPercentage = PRINT_MARKUP_PERCENTAGE || 30;
      const shippingMarkupPercentage = SHIPPING_MARKUP_PERCENTAGE || 10;

      const printCostWithMarkup = luluPrintCost * (1 + printMarkupPercentage / 100);
      const shippingCostWithMarkup = luluShippingCost * (1 + shippingMarkupPercentage / 100);
      const totalCostUSD = printCostWithMarkup + shippingCostWithMarkup;
      const totalCostCents = Math.ceil(totalCostUSD * 100);

      const costBreakdown = {
        book_id: bookId,
        book_title: book.title,
        page_count: book.page_count,
        quantity: quantity,
        lulu_cost_usd: luluTotalCost,
        lulu_print_cost: luluPrintCost,
        lulu_shipping_cost: luluShippingCost,
        print_markup_percentage: printMarkupPercentage,
        shipping_markup_percentage: shippingMarkupPercentage,
        total_cost_usd: totalCostUSD,
        total_cost_cents: totalCostCents,
        shipping_level: shippingLevel,
        currency: luluCostData.currency,
        cost_breakdown: {
          line_items: luluCostData.line_item_costs,
          shipping: luluCostData.shipping_cost,
          fulfillment: luluCostData.fulfillment_cost,
          fees: luluCostData.fees || [],
        },
      };

      logger.info("Order cost calculated successfully", {
        bookId,
        totalCostCents,
        totalCostUSD,
        luluTotalCost,
      });

      return costBreakdown;
    } catch (error) {
      logger.error("Failed to calculate order cost:", error.message);
      throw new Error(`${error.message.replace("Error: ", "")}`);
    }
  }

  /**
   * Create a Stripe checkout session for print order
   */
  async createPrintOrderCheckout(userId, orderData) {
    try {
      logger.info(`Creating print order checkout for user ${userId}`);

      const { bookId, quantity, shippingAddress, shippingLevel } = orderData;

      // Validate book exists and user has access
      const book = await Book.findById(bookId);
      if (!book) {
        throw new Error("Book not found");
      }

      if (book.user_id.toString() !== userId.toString()) {
        throw new Error("Unauthorized: You can only print your own books");
      }

      if (book.generation_status !== "completed") {
        throw new Error("Book must be completed before printing");
      }

      // Calculate cost
      const costData = await this.calculateOrderCost(
        bookId,
        quantity,
        shippingAddress,
        shippingLevel
      );

      // Get user email
      const user = await User.findById(userId);
      const userEmail = user?.email;

      // Create Stripe checkout session with dynamic pricing
      const metadata = {
        order_type: "print",
        book_id: bookId,
        user_id: userId,
        quantity: quantity.toString(),
        page_count: book.page_count.toString(),
        shipping_level: shippingLevel,
        shipping_country: shippingAddress.country_code,
        shipping_city: shippingAddress.city,
        shipping_state: shippingAddress.state_code,
        shipping_postal_code: shippingAddress.postal_code,
        lulu_print_cost: costData.lulu_print_cost.toString(),
        lulu_shipping_cost: costData.lulu_shipping_cost.toString(),
        print_markup: costData.print_markup_percentage.toString(),
        shipping_markup: costData.shipping_markup_percentage.toString(),
      };

      const session = await stripeService.createPrintCheckoutSession(
        bookId,
        costData.total_cost_cents,
        userId,
        userEmail,
        metadata
      );

      logger.info("Print order checkout session created", {
        sessionId: session.id,
        bookId,
        userId,
        totalCostCents: costData.total_cost_cents,
      });

      return {
        checkoutUrl: session.url,
        sessionId: session.id,
        costData,
      };
    } catch (error) {
      logger.error("Failed to create print order checkout:", error.message);
      throw new Error(`Failed to create print order checkout: ${error.message}`);
    }
  }

  /**
   * Create a new print order (called after successful payment)
   */
  async createPrintOrder(userId, orderData, stripeSessionId = null) {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      logger.info(`Creating print order for user ${userId}`);

      const { bookId, quantity, shippingAddress, shippingLevel, costData } = orderData;

      // Validate book exists
      const book = await Book.findById(bookId).session(session);
      if (!book) {
        throw new Error("Book not found");
      }

      // Generate external ID for the print order
      const timestamp = Date.now();
      const random = Math.random().toString(36).substring(2, 8).toUpperCase();
      const externalId = `PTO_${timestamp}_${random}`;

      // Create print order
      const printOrder = new PrintOrder({
        user_id: userId,
        book_id: bookId,
        external_id: externalId,
        quantity: quantity,
        total_cost_cents: costData.total_cost_cents,
        lulu_cost_usd: costData.lulu_cost_usd,
        markup_percentage: costData.print_markup_percentage,
        shipping_address: shippingAddress,
        shipping_level: shippingLevel,
        stripe_session_id: stripeSessionId,
        status: "created",
      });

      // Save the order within the session to get the MongoDB _id
      await printOrder.save({ session });

      // Generate print-ready PDFs with the order ID
      const pdfUrls = await this.generatePrintReadyPDFs(bookId, userId, printOrder._id.toString());

      // Update the order with PDF URLs
      printOrder.cover_pdf_url = pdfUrls.coverPdfUrl;
      printOrder.interior_pdf_url = pdfUrls.interiorPdfUrl;

      await printOrder.save({ session });

      // Submit to Lulu API
      const luluPrintJob = await luluService.createPrintJob({
        external_id: printOrder.external_id,
        title: book.title,
        quantity: quantity,
        shipping_address: shippingAddress,
        shipping_level: shippingLevel,
        cover_pdf_url: pdfUrls.coverPdfUrl,
        interior_pdf_url: pdfUrls.interiorPdfUrl,
      });

      // Update print order with Lulu job ID and status
      printOrder.lulu_print_job_id = luluPrintJob.id;
      printOrder.status = luluPrintJob.status?.name?.toLowerCase() || "unpaid";
      printOrder.ordered_at = new Date();
      await printOrder.save({ session });

      await session.commitTransaction();

      logger.info("Print order created successfully", {
        printOrderId: printOrder._id,
        externalId: printOrder.external_id,
        luluPrintJobId: luluPrintJob.id,
      });

      return {
        printOrder: await PrintOrder.findById(printOrder._id).populate(
          "book_id",
          "title"
        ),
        costData,
      };
    } catch (error) {
      await session.abortTransaction();
      logger.error("Failed to create print order:", error.message);
      throw new Error(`Failed to create print order: ${error.message}`);
    } finally {
      session.endSession();
    }
  }

  /**
   * Process successful print payment from Stripe webhook
   */
  async processPrintPaymentSuccess(stripeSession) {
    try {
      const { metadata } = stripeSession;

      if (metadata.order_type !== "print" && metadata.type !== "book_print") {
        return;
      }

      // Check if print order already exists for this session
      const existingOrder = await PrintOrder.findOne({
        stripe_session_id: stripeSession.id,
      });

      if (existingOrder) {
        logger.info(`Print order already exists for session ${stripeSession.id}`);
        return existingOrder;
      }

      // Reconstruct order data from metadata
      const orderData = {
        bookId: metadata.book_id,
        quantity: parseInt(metadata.quantity),
        shippingAddress: {
          country_code: metadata.shipping_country,
          city: metadata.shipping_city,
          state_code: metadata.shipping_state,
          postal_code: metadata.shipping_postal_code,
          // Note: Full address details should be collected from Stripe checkout
          name: stripeSession.shipping_details?.name || stripeSession.customer_details?.name,
          line1: stripeSession.shipping_details?.address?.line1,
          line2: stripeSession.shipping_details?.address?.line2,
        },
        shippingLevel: metadata.shipping_level,
        costData: {
          total_cost_cents: stripeSession.amount_total,
          lulu_cost_usd: parseFloat(metadata.lulu_print_cost) + parseFloat(metadata.lulu_shipping_cost),
          print_markup_percentage: parseInt(metadata.print_markup),
        },
      };

      // Create the print order
      const result = await this.createPrintOrder(
        metadata.user_id,
        orderData,
        stripeSession.id
      );

      logger.info("Print order created from Stripe webhook", {
        printOrderId: result.printOrder._id,
        stripeSessionId: stripeSession.id,
      });

      return result.printOrder;
    } catch (error) {
      logger.error("Failed to process print payment:", error.message);
      throw error;
    }
  }

  /**
   * Generate print-ready PDFs for a book
   */
  async generatePrintReadyPDFs(bookId, userId, orderId) {
    try {
      logger.info(`Generating print-ready PDFs for book ${bookId}`);

      // Use the dedicated print-ready PDF service
      const pdfUrls = await printReadyPDFService.generatePrintReadyPDFs(bookId, userId, orderId);

      logger.info("Print-ready PDFs generated successfully", {
        bookId,
        userId,
        orderId,
        coverPdfUrl: pdfUrls.coverPdfUrl,
        interiorPdfUrl: pdfUrls.interiorPdfUrl,
      });

      return pdfUrls;
    } catch (error) {
      logger.error("Failed to generate print-ready PDFs:", error.message);
      throw new Error(`Failed to generate print-ready PDFs: ${error.message}`);
    }
  }

  /**
   * Get user's print orders
   */
  async getUserPrintOrders(userId, options = {}) {
    try {
      const { page = 1, limit = 10, status } = options;
      const skip = (page - 1) * limit;

      const query = { user_id: userId };
      if (status) {
        query.status = status;
      }

      const orders = await PrintOrder.find(query)
        .populate("book_id", "title front_cover_image_url")
        .sort({ created_at: -1 })
        .skip(skip)
        .limit(limit);

      const total = await PrintOrder.countDocuments(query);

      return {
        orders,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        },
      };
    } catch (error) {
      logger.error("Failed to get user print orders:", error.message);
      throw new Error("Failed to get user print orders");
    }
  }

  /**
   * Get print order by ID
   */
  async getPrintOrderById(orderId, userId = null) {
    try {
      const query = { _id: orderId };
      if (userId) {
        query.user_id = userId;
      }

      const order = await PrintOrder.findOne(query)
        .populate("book_id", "title front_cover_image_url page_count")
        .populate("user_id", "first_name last_name email");

      if (!order) {
        throw new Error("Print order not found");
      }

      return order;
    } catch (error) {
      logger.error("Failed to get print order:", error.message);
      throw new Error("Failed to get print order");
    }
  }

  /**
   * Cancel a print order
   */
  async cancelPrintOrder(orderId, userId) {
    try {
      logger.info(`Canceling print order ${orderId} for user ${userId}`);

      const printOrder = await PrintOrder.findOne({
        _id: orderId,
        user_id: userId,
      });

      if (!printOrder) {
        throw new Error("Print order not found");
      }

      if (!printOrder.canBeCanceled()) {
        throw new Error("Print order cannot be canceled at this stage");
      }

      // Cancel with Lulu if we have a print job ID
      if (printOrder.lulu_print_job_id) {
        try {
          await luluService.cancelPrintJob(printOrder.lulu_print_job_id);
        } catch (error) {
          logger.warn(
            "Failed to cancel Lulu print job, continuing with local cancellation:",
            error.message
          );
        }
      }

      // Update order status
      printOrder.status = "canceled";
      await printOrder.save();

      // TODO: Process Stripe refund if needed
      if (printOrder.stripe_session_id) {
        logger.info("Note: Stripe refund should be processed manually for now", {
          orderId,
          stripeSessionId: printOrder.stripe_session_id,
        });
      }

      logger.info("Print order canceled successfully", {
        orderId,
      });

      return printOrder;
    } catch (error) {
      logger.error("Failed to cancel print order:", error.message);
      throw new Error(`Failed to cancel print order: ${error.message}`);
    }
  }

  /**
   * Update print order status from Lulu webhook
   */
  async updatePrintOrderFromWebhook(webhookData) {
    try {
      const { id: luluPrintJobId, status, line_item_statuses } = webhookData;

      const printOrder = await PrintOrder.findOne({
        lulu_print_job_id: luluPrintJobId,
      });
      if (!printOrder) {
        logger.warn(`Print order not found for Lulu job ID: ${luluPrintJobId}`);
        return null;
      }

      const oldStatus = printOrder.status;
      const newStatus = status.name.toLowerCase();

      // Update order status
      printOrder.status = newStatus;

      // Handle status-specific updates
      if (
        newStatus === "shipped" &&
        line_item_statuses &&
        line_item_statuses.length > 0
      ) {
        const trackingInfo = line_item_statuses[0].messages;
        if (trackingInfo) {
          printOrder.tracking_info = {
            tracking_id: trackingInfo.tracking_id,
            tracking_urls: trackingInfo.tracking_urls || [],
            carrier_name: trackingInfo.carrier_name,
          };
          printOrder.shipped_at = new Date();
        }
      }

      if (newStatus === "rejected") {
        printOrder.error_message =
          status.message || "Order was rejected by Lulu";
      }

      await printOrder.save();

      logger.info("Print order status updated from webhook", {
        printOrderId: printOrder._id,
        luluPrintJobId,
        oldStatus,
        newStatus,
      });

      return printOrder;
    } catch (error) {
      logger.error("Failed to update print order from webhook:", error.message);
      throw error;
    }
  }
}

module.exports = new PrintOrderService();
