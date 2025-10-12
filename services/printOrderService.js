const mongoose = require("mongoose");
const { PrintOrder, Book, User } = require("../models");
const luluService = require("./luluService");
const stripeService = require("./stripeService");
const printReadyPDFService = require("./printReadyPDFService");
const logger = require("../utils/logger");
const {
  PRINT_MARKUP_PERCENTAGE,
  SHIPPING_MARKUP_PERCENTAGE,
} = require("../utils/constants");

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

      // Get Lulu print cost
      const luluCostData = await luluService.calculatePrintCost(
        book.page_count,
        quantity,
        shippingAddress,
        shippingLevel
      );

      // Calculate costs with markup
      const luluPrintCost = parseFloat(
        luluCostData.line_item_costs?.[0]?.total_cost_incl_tax || 0
      );
      const luluShippingCost = parseFloat(
        luluCostData.shipping_cost?.total_cost_incl_tax || 0
      );
      const luluTotalCost = parseFloat(luluCostData.total_cost_incl_tax);

      // Apply markups
      const printMarkupPercentage = PRINT_MARKUP_PERCENTAGE || 100;
      const shippingMarkupPercentage = SHIPPING_MARKUP_PERCENTAGE || 5;

      const printCostWithMarkup =
        luluPrintCost * (1 + printMarkupPercentage / 100);
      const shippingCostWithMarkup =
        luluShippingCost * (1 + shippingMarkupPercentage / 100);
      const totalCostGBP = printCostWithMarkup + shippingCostWithMarkup;
      const totalCostCents = Math.ceil(totalCostGBP * 100);

      const costBreakdown = {
        book_id: bookId,
        book_title: book.title,
        quantity,
        page_count: book.page_count,
        currency: "GBP",
        lulu_print_cost_gbp: luluPrintCost,
        lulu_shipping_cost_gbp: luluShippingCost,
        lulu_total_cost_gbp: luluTotalCost,
        print_markup_percentage: printMarkupPercentage,
        shipping_markup_percentage: shippingMarkupPercentage,
        display_print_cost_gbp: printCostWithMarkup.toFixed(2),
        display_shipping_cost_gbp: shippingCostWithMarkup.toFixed(2),
        display_total_cost_gbp: totalCostGBP.toFixed(2),
        total_cost_cents: totalCostCents,
      };

      return costBreakdown;
    } catch (error) {
      logger.error("Failed to calculate order cost:", error);
      throw new Error("Error calculating order cost");
    }
  }
}

module.exports = new PrintOrderService();
