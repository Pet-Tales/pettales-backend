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

      // Calculate cost with validated shipping option
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
      const printMarkupPercentage = PRINT_MARKUP_PERCENTAGE || 100;
      const shippingMarkupPercentage = SHIPPING_MARKUP_PERCENTAGE || 5;

      const printCostWithMarkup = luluPrintCost * (1 + printMarkupPercentage / 100);
      const shippingCostWithMarkup = luluShippingCost * (1 + shippingMarkupPercentage / 100);
      const totalCostGBP = printCostWithMarkup + shippingCostWithMarkup;
      const totalCostCents = Math.ceil(totalCostGBP * 100);

      const costBreakdown = {
        book_id: bookId,
        book_title: book.title,
        page_count: book.page_count,
        quantity: quantity,
        lulu_cost_gbp: luluTotalCost,
        lulu_print_cost: luluPrintCost,
        lulu_shipping_cost: luluShippingCost,
        print_markup_percentage: printMarkupPercentage,
        shipping_markup_percentage: shippingMarkupPercentage,
        total_cost_gbp: totalCostGBP,
        total_cost_cents: totalCostCents,
        shipping_level: shippingLevel,
        currency: luluCostData.currency,
        cost_breakdown: {
          line_items: luluCostData.line_item_costs,
          shipping: luluCostData.shipping_cost,
          fulfillment: luluCostData.fulfillment_cost,
          fees: luluCostData.fees || [],
        },
        display_print_cost_gbp: printCostWithMarkup,
        display_shipping_cost_gbp: shippingCostWithMarkup,
      };

      logger.info("Order cost calculated successfully", {
        bookId,
        lulu_print_cost: luluPrintCost,
        lulu_shipping_cost: luluShippingCost,
        display_print_cost_gbp: printCostWithMarkup,
        display_shipping_cost_gbp: shippingCostWithMarkup,
        total_cost_gbp: totalCostGBP,
        totalCostCents,
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
      // 🔒 Never let null/undefined reach Stripe or .toString()
      const safeUserId = userId ? String(userId) : ""; // empty string instead of null
      const {
        bookId,
        quantity,
        shippingAddress,
        shippingLevel,
      } = orderData ?? {};

      const qty = Number.isFinite(Number(quantity)) ? Number(quantity) : 1;

      logger.info(`Creating print order checkout session`, {
        userId: safeUserId,
        bookId,
        quantity: qty,
        shippingLevel,
      });

      if (!safeUserId) {
        logger.warn("Missing user ID when creating checkout session");
      }

      const book = await Book.findById(bookId);
      if (!book) {
        throw new Error("Book not found");
      }

      // Create a print order record with status 'created' (not yet printed)
      const printOrder = await PrintOrder.create({
        user_id: safeUserId ? new mongoose.Types.ObjectId(safeUserId) : undefined,
        book_id: new mongoose.Types.ObjectId(bookId),
        quantity: qty,
        shipping_address: shippingAddress,
        shipping_level: shippingLevel,
        status: "created",
      });

      // Create Stripe checkout session
      const checkoutSession = await stripeService.createCheckoutSession({
        printOrderId: printOrder._id.toString(),
        bookId,
        quantity: qty,
        shippingAddress,
        shippingLevel,
      });

      logger.info("Print order checkout session created successfully", {
        sessionId: checkoutSession.id,
        url: checkoutSession.url,
      });

      return {
        checkoutUrl: checkoutSession.url,
        sessionId: checkoutSession.id,
      };
    } catch (error) {
      logger.error("Failed to create print order checkout session:", error.message);
      throw new Error(error.message);
    }
  }

  /**
   * Create a print order record (deprecated in favor of checkout)
   */
  async createPrintOrder(userId, orderData) {
    try {
      const printOrder = await PrintOrder.create({
        user_id: new mongoose.Types.ObjectId(userId),
        book_id: new mongoose.Types.ObjectId(orderData.bookId),
        quantity: orderData.quantity,
        shipping_address: orderData.shippingAddress,
        shipping_level: orderData.shippingLevel,
        status: "created",
      });

      logger.info("Print order created successfully", {
        orderId: printOrder._id,
      });

      return printOrder;
    } catch (error) {
      logger.error("Failed to create print order:", error.message);
      throw new Error(error.message);
    }
  }

  /**
   * Get user's print orders
   */
  async getPrintOrders(userId, page = 1, limit = 10) {
    try {
      const skip = (page - 1) * limit;

      const orders = await PrintOrder.find({ user_id: userId })
        .sort({ created_at: -1 })
        .skip(skip)
        .limit(limit)
        .lean();

      const totalOrders = await PrintOrder.countDocuments({ user_id: userId });

      return {
        orders,
        pagination: {
          page,
          limit,
          total: totalOrders,
          pages: Math.ceil(totalOrders / limit),
        },
      };
    } catch (error) {
      logger.error("Failed to get print orders:", error.message);
      throw new Error(error.message);
    }
  }

  /**
   * Get print order status from Lulu
   */
  async getPrintOrderStatus(orderId) {
    try {
      const order = await PrintOrder.findById(orderId);
      if (!order) {
        throw new Error("Print order not found");
      }

      // For simplicity: return the status from our DB (extend to query Lulu if needed)
      return { status: order.status };
    } catch (error) {
      logger.error("Failed to get print order status:", error.message);
      throw new Error(error.message);
    }
  }
}

module.exports = new PrintOrderService();
