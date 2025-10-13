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
      logger.info(`Calculating order cost for book ${bookId}, quantity: ${quantity}`);

      const book = await Book.findById(bookId);
      if (!book) throw new Error("Book not found");

      const availableShippingOptions = await luluService.getShippingOptions(
        shippingAddress,
        book.page_count,
        quantity
      );

      const isShippingLevelAvailable = availableShippingOptions.some(
        (option) => option.level === shippingLevel
      );
      if (!isShippingLevelAvailable) {
        const availableLevels = availableShippingOptions.map((o) => o.level);
        throw new Error(
          `Shipping level "${shippingLevel}" is not available. Options: ${availableLevels.join(", ")}`
        );
      }

      const luluCostData = await luluService.calculatePrintCost(
        book.page_count,
        quantity,
        shippingAddress,
        shippingLevel
      );

      // ✅ These fields match Lulu’s real API (from your working version)
      const luluPrintCost = parseFloat(
        luluCostData.line_item_costs?.[0]?.total_cost_incl_tax || 0
      );
      const luluShippingCost = parseFloat(
        luluCostData.shipping_cost?.total_cost_incl_tax || 0
      );
      const luluTotalCost = parseFloat(luluCostData.total_cost_incl_tax);

      const printMarkupPercentage = PRINT_MARKUP_PERCENTAGE || 100;
      const shippingMarkupPercentage = SHIPPING_MARKUP_PERCENTAGE || 5;

      const printCostWithMarkup = luluPrintCost * (1 + printMarkupPercentage / 100);
      const shippingCostWithMarkup =
        luluShippingCost * (1 + shippingMarkupPercentage / 100);
      const totalCostGBP = printCostWithMarkup + shippingCostWithMarkup;
      const totalCostCents = Math.ceil(totalCostGBP * 100);

      const costBreakdown = {
        book_id: bookId,
        book_title: book.title,
        page_count: book.page_count,
        quantity,
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

      return costBreakdown;
    } catch (error) {
      logger.error("Failed to calculate order cost:", error.message);
      throw new Error("Error calculating order cost");
    }
  }
}

module.exports = new PrintOrderService();
