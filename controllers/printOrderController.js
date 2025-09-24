const printOrderService = require("../services/printOrderService");
const { Book } = require("../models");
const logger = require("../utils/logger");
const { PRINT_MARKUP_PERCENTAGE, SHIPPING_MARKUP_PERCENTAGE } = require("../utils/constants");

/**
 * Calculate print order cost
 * POST /api/print-orders/calculate-cost
 */
const calculateCost = async (req, res) => {
  try {
    const { bookId, quantity, shippingAddress, shippingLevel } = req.body;

    logger.info(`Calculating cost for print order`, {
      userId: req.user.id,
      bookId,
      quantity,
      shippingLevel,
    });

    const costData = await printOrderService.calculateOrderCost(
      bookId,
      quantity,
      shippingAddress,
      shippingLevel
    );

    // Filter out internal markup information for frontend response
    const { 
      lulu_cost_usd, 
      lulu_print_cost,
      lulu_shipping_cost,
      print_markup_percentage, 
      shipping_markup_percentage,
      ...publicCostData 
    } = costData;

    res.status(200).json({
      success: true,
      message: "Cost calculated successfully",
      data: publicCostData,
    });
  } catch (error) {
    logger.error("Failed to calculate print order cost:", error.message);
    res.status(400).json({
      success: false,
      message: error.message,
      error: error.message,
    });
  }
};

/**
 * Create a print order checkout session
 * POST /api/print-orders/create-checkout
 * This replaces the old createPrintOrder that used credits
 */
const createPrintOrderCheckout = async (req, res) => {
  try {
    const { bookId, quantity, shippingAddress, shippingLevel } = req.body;
    const userId = req.user.id;

    logger.info(`Creating print order checkout session`, {
      userId,
      bookId,
      quantity,
      shippingLevel,
    });

    const result = await printOrderService.createPrintOrderCheckout(userId, {
      bookId,
      quantity,
      shippingAddress,
      shippingLevel,
    });

    res.status(200).json({
      success: true,
      message: "Print order checkout session created successfully",
      data: {
        checkoutUrl: result.checkoutUrl,
        sessionId: result.sessionId,
      },
    });
  } catch (error) {
    logger.error("Failed to create print order checkout:", error.message);
    res.status(400).json({
      success: false,
      message: error.message,
      error: error.message,
    });
  }
};

/**
 * DEPRECATED: Old create print order endpoint
 * Keeping for backwards compatibility but returns checkout session instead
 * POST /api/print-orders/create
 */
const createPrintOrder = async (req, res) => {
  logger.warn("Using deprecated createPrintOrder endpoint - redirecting to checkout");
  return createPrintOrderCheckout(req, res);
};

/**
 * Get user's print orders
 * GET /api/print-orders/
 */
const getUserPrintOrders = async (req, res) => {
  try {
    const userId = req.user.id;
    const { page = 1, limit = 10, status } = req.query;

    logger.info(`Getting print orders for user ${userId}`, {
      page,
      limit,
      status,
    });

    const result = await printOrderService.getUserPrintOrders(userId, {
      page: parseInt(page),
      limit: parseInt(limit),
      status,
    });

    res.status(200).json({
      success: true,
      message: "Print orders retrieved successfully",
      data: result.orders,
      pagination: result.pagination,
    });
  } catch (error) {
    logger.error("Failed to get user print orders:", error.message);
    res.status(400).json({
      success: false,
      message: error.message,
      error: error.message,
    });
  }
};

/**
 * Get specific print order
 * GET /api/print-orders/:orderId
 */
const getPrintOrder = async (req, res) => {
  try {
    const { orderId } = req.params;
    const userId = req.user.id;

    logger.info(`Getting print order ${orderId} for user ${userId}`);

    const printOrder = await printOrderService.getPrintOrderById(
      orderId,
      userId
    );

    res.status(200).json({
      success: true,
      message: "Print order retrieved successfully",
      data: printOrder,
    });
  } catch (error) {
    logger.error("Failed to get print order:", error.message);
    const statusCode = error.message.includes("not found") ? 404 : 400;
    res.status(statusCode).json({
      success: false,
      message: error.message,
      error: error.message,
    });
  }
};

/**
 * Cancel a print order
 * DELETE /api/print-orders/:orderId
 */
const cancelPrintOrder = async (req, res) => {
  try {
    const { orderId } = req.params;
    const userId = req.user.id;

    logger.info(`Canceling print order ${orderId} for user ${userId}`);

    const canceledOrder = await printOrderService.cancelPrintOrder(
      orderId,
      userId
    );

    res.status(200).json({
      success: true,
      message: "Print order canceled successfully",
      data: canceledOrder,
    });
  } catch (error) {
    logger.error("Failed to cancel print order:", error.message);
    const statusCode = error.message.includes("not found") ? 404 : 400;
    res.status(statusCode).json({
      success: false,
      message: error.message,
      error: error.message,
    });
  }
};

/**
 * Get print order status from Lulu
 * GET /api/print-orders/:orderId/status
 */
const getPrintOrderStatus = async (req, res) => {
  try {
    const { orderId } = req.params;
    const userId = req.user.id;

    logger.info(`Getting print order status ${orderId} for user ${userId}`);

    const printOrder = await printOrderService.getPrintOrderById(
      orderId,
      userId
    );

    if (!printOrder.lulu_print_job_id) {
      return res.status(400).json({
        success: false,
        message: "Print order has not been submitted to Lulu yet",
      });
    }

    // Get latest status from Lulu
    const luluService = require("../services/luluService");
    const luluStatus = await luluService.getPrintJobStatus(
      printOrder.lulu_print_job_id
    );

    // Update local status if different
    if (luluStatus.status?.name?.toLowerCase() !== printOrder.status) {
      await printOrderService.updatePrintOrderFromWebhook(luluStatus);
    }

    res.status(200).json({
      success: true,
      message: "Print order status retrieved successfully",
      data: {
        localStatus: printOrder.status,
        luluStatus: luluStatus.status,
        trackingInfo: printOrder.tracking_info,
        lastUpdated: printOrder.updated_at,
      },
    });
  } catch (error) {
    logger.error("Failed to get print order status:", error.message);
    const statusCode = error.message.includes("not found") ? 404 : 400;
    res.status(statusCode).json({
      success: false,
      message: error.message,
      error: error.message,
    });
  }
};

/**
 * Get available shipping options for a location
 * POST /api/print-orders/shipping-options
 */
const getShippingOptions = async (req, res) => {
  try {
    const { shippingAddress, bookId } = req.body;

    logger.info(`Getting shipping options for location`, {
      country: shippingAddress.country_code,
      city: shippingAddress.city,
      bookId,
    });

    // Get book details to determine page count
    const book = await Book.findById(bookId);
    if (!book) {
      return res.status(404).json({
        success: false,
        message: "Book not found",
      });
    }

    // Get available shipping options from Lulu API
    const luluService = require("../services/luluService");
    const luluShippingOptions = await luluService.getShippingOptions(
      shippingAddress,
      book.page_count,
      1 // Default quantity for options lookup
    );
const probe = await luluService.calculatePrintCost(book.page_count, 1, shippingAddress, luluShippingOptions[0].level);
const basePrintIncl = parseFloat(probe.line_item_costs?.[0]?.total_cost_incl_tax || 0);
const printWithMarkup = basePrintIncl * (1 + (PRINT_MARKUP_PERCENTAGE || 100) / 100);

    // Map Lulu shipping options to our format with user-friendly names
    const shippingOptionsMap = {
      MAIL: {
        name: "Standard Mail",
        description: "Slowest shipping method. Tracking may not be available.",
        estimatedDays: "7-14 business days",
      },
      PRIORITY_MAIL: {
        name: "Priority Mail",
        description: "Priority mail shipping with tracking.",
        estimatedDays: "3-7 business days",
      },
      GROUND: {
        name: "Ground Shipping",
        description: "Courier-based ground transportation.",
        estimatedDays: "3-5 business days",
      },
      EXPEDITED: {
        name: "Expedited Shipping",
        description: "2nd day delivery via air mail.",
        estimatedDays: "2-3 business days",
      },
      EXPRESS: {
        name: "Express Shipping",
        description: "Overnight delivery. Fastest option available.",
        estimatedDays: "1-2 business days",
      },
    };

    // Map Lulu options to our format, only including available options
    const shippingOptions = luluShippingOptions.map((luluOption) => {
      const mappedOption = shippingOptionsMap[luluOption.level];
      return {
        level: luluOption.level,
        name: mappedOption?.name || luluOption.level,
        description: mappedOption?.description || "Shipping option",
        estimatedDays:
          mappedOption?.estimatedDays ||
          `${luluOption.total_days_min || "Unknown"}-${
            luluOption.total_days_max || "Unknown"
          } business days`,
        cost: ((parseFloat(luluOption.cost_incl_tax || 0) * (1 + (SHIPPING_MARKUP_PERCENTAGE || 5) / 100)) + printWithMarkup).toFixed(2),
        traceable: luluOption.traceable || false,
        minDeliveryDate: luluOption.min_delivery_date,
        maxDeliveryDate: luluOption.max_delivery_date,
      };
    });

    logger.info("Shipping options retrieved successfully", {
      country: shippingAddress.country_code,
      availableOptions: shippingOptions.map((opt) => opt.level),
    });

    res.status(200).json({
      success: true,
      message: "Shipping options retrieved successfully",
      data: shippingOptions,
    });
  } catch (error) {
    logger.error("Failed to get shipping options:", error.message);
    res.status(400).json({
      success: false,
      message: error.message,
      error: error.message,
    });
  }
};

module.exports = {
  calculateCost,
  createPrintOrderCheckout, // New method for Stripe checkout
  createPrintOrder, // Deprecated but redirects to checkout
  getUserPrintOrders,
  getPrintOrder,
  cancelPrintOrder,
  getPrintOrderStatus,
  getShippingOptions,
};
