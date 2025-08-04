const mongoose = require("mongoose");
const { PrintOrder, Book, User, CreditTransaction } = require("../models");
const luluService = require("./luluService");
const creditService = require("./creditService");
const printReadyPDFService = require("./printReadyPDFService");
const logger = require("../utils/logger");
const { CREDIT_VALUE_USD } = require("../utils/constants");

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

      const luluCostUSD = parseFloat(luluCostData.total_cost_incl_tax);
      const markupPercentage = 50; // 50% markup
      const totalCostUSD = luluCostUSD * (1 + markupPercentage / 100);
      const totalCostCredits = Math.ceil(totalCostUSD / CREDIT_VALUE_USD);

      const costBreakdown = {
        book_id: bookId,
        book_title: book.title,
        page_count: book.page_count,
        quantity: quantity,
        lulu_cost_usd: luluCostUSD, // Keep for internal use (database storage)
        markup_percentage: markupPercentage, // Keep for internal use (database storage)
        total_cost_usd: totalCostUSD,
        total_cost_credits: totalCostCredits,
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
        totalCostCredits,
        totalCostUSD,
        luluCostUSD,
      });

      return costBreakdown;
    } catch (error) {
      logger.error("Failed to calculate order cost:", error.message);
      // throw new Error(`Failed to calculate order cost: ${error.message}`);
      throw new Error(`${error.message.replace("Error: ", "")}`);
    }
  }

  /**
   * Create a new print order
   */
  async createPrintOrder(userId, orderData) {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      logger.info(`Creating print order for user ${userId}`);

      const { bookId, quantity, shippingAddress, shippingLevel } = orderData;

      // Validate book exists and user has access
      const book = await Book.findById(bookId).session(session);
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

      // Check user has sufficient credits
      const user = await User.findById(userId).session(session);
      if (user.credits_balance < costData.total_cost_credits) {
        throw new Error(
          `Insufficient credits. Required: ${costData.total_cost_credits}, Available: ${user.credits_balance}`
        );
      }

      // Generate print-ready PDFs
      const pdfUrls = await this.generatePrintReadyPDFs(bookId);

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
        total_cost_credits: costData.total_cost_credits,
        lulu_cost_usd: costData.lulu_cost_usd,
        markup_percentage: costData.markup_percentage,
        shipping_address: shippingAddress,
        shipping_level: shippingLevel,
        cover_pdf_url: pdfUrls.coverPdfUrl,
        interior_pdf_url: pdfUrls.interiorPdfUrl,
        status: "created",
      });

      await printOrder.save({ session });

      // Deduct credits from user
      const updatedUser = await User.findByIdAndUpdate(
        userId,
        { $inc: { credits_balance: -costData.total_cost_credits } },
        { new: true, session }
      );

      // Create credit transaction record
      const creditTransaction = await CreditTransaction.create(
        [
          {
            user_id: userId,
            type: "usage",
            amount: -costData.total_cost_credits,
            description: `Print order for "${book.title}" - ${quantity} copies`,
            book_id: bookId,
          },
        ],
        { session }
      );

      // Update print order with credit transaction reference
      printOrder.credit_transaction_id = creditTransaction[0]._id;
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
        creditsDeducted: costData.total_cost_credits,
        newUserBalance: updatedUser.credits_balance,
      });

      return {
        printOrder: await PrintOrder.findById(printOrder._id).populate(
          "book_id",
          "title"
        ),
        costData,
        newCreditBalance: updatedUser.credits_balance,
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
   * Generate print-ready PDFs for a book
   */
  async generatePrintReadyPDFs(bookId) {
    try {
      logger.info(`Generating print-ready PDFs for book ${bookId}`);

      // Use the dedicated print-ready PDF service
      const pdfUrls = await printReadyPDFService.generatePrintReadyPDFs(bookId);

      logger.info("Print-ready PDFs generated successfully", {
        bookId,
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
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      logger.info(`Canceling print order ${orderId} for user ${userId}`);

      const printOrder = await PrintOrder.findOne({
        _id: orderId,
        user_id: userId,
      }).session(session);

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

      // Refund credits to user
      await this.refundPrintOrder(printOrder._id, session);

      // Update order status
      printOrder.status = "canceled";
      await printOrder.save({ session });

      await session.commitTransaction();

      logger.info("Print order canceled successfully", {
        orderId,
        creditsRefunded: printOrder.total_cost_credits,
      });

      return printOrder;
    } catch (error) {
      await session.abortTransaction();
      logger.error("Failed to cancel print order:", error.message);
      throw new Error(`Failed to cancel print order: ${error.message}`);
    } finally {
      session.endSession();
    }
  }

  /**
   * Refund credits for a failed or canceled print order
   */
  async refundPrintOrder(
    printOrderId,
    session = null,
    reason = "Order failed"
  ) {
    const useSession = session || (await mongoose.startSession());
    if (!session) useSession.startTransaction();

    try {
      const printOrder = await PrintOrder.findById(printOrderId).session(
        useSession
      );
      if (!printOrder) {
        throw new Error("Print order not found");
      }

      // Check if already refunded
      const existingRefund = await CreditTransaction.findOne({
        user_id: printOrder.user_id,
        type: "refund",
        description: {
          $regex: `Refund for print order ${printOrder.external_id}`,
        },
      }).session(useSession);

      if (existingRefund) {
        logger.info("Print order already refunded", {
          printOrderId,
          existingRefundId: existingRefund._id,
        });
        return existingRefund;
      }

      // Get user current balance for logging
      const user = await User.findById(printOrder.user_id).session(useSession);
      const oldBalance = user.credits_balance;

      // Refund credits to user
      const updatedUser = await User.findByIdAndUpdate(
        printOrder.user_id,
        { $inc: { credits_balance: printOrder.total_cost_credits } },
        { new: true, session: useSession }
      );

      // Create refund transaction record
      const refundTransaction = await CreditTransaction.create(
        [
          {
            user_id: printOrder.user_id,
            type: "refund",
            amount: printOrder.total_cost_credits,
            description: `Refund for print order ${printOrder.external_id} - ${reason}`,
            book_id: printOrder.book_id,
          },
        ],
        { session: useSession }
      );

      if (!session) {
        await useSession.commitTransaction();
      }

      logger.info("Print order refunded successfully", {
        printOrderId,
        userId: printOrder.user_id,
        creditsRefunded: printOrder.total_cost_credits,
        oldBalance,
        newBalance: updatedUser.credits_balance,
        reason,
        refundTransactionId: refundTransaction[0]._id,
      });

      return refundTransaction[0];
    } catch (error) {
      if (!session) {
        await useSession.abortTransaction();
      }
      logger.error("Failed to refund print order:", {
        printOrderId,
        error: error.message,
        reason,
      });
      throw error;
    } finally {
      if (!session) {
        useSession.endSession();
      }
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
        // Refund will be handled separately
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
