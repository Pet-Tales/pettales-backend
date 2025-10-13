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
        throw new Error(`Book not found: ${bookId}`);
      }

      // Get Lulu cost
      const luluCost = await luluService.calculateCost(book.luluProductId, quantity);

      // Apply print markup
      const printCost = luluCost.print_cost * (1 + PRINT_MARKUP_PERCENTAGE / 100);

      // Apply shipping cost and markup
      const shippingCost =
        (luluCost.shipping_cost[shippingLevel] || luluCost.shipping_cost.standard) *
        (1 + SHIPPING_MARKUP_PERCENTAGE / 100);

      const totalCost = printCost + shippingCost;

      logger.info(
        `Order cost calculated: print=${printCost}, shipping=${shippingCost}, total=${totalCost}`
      );

      return { totalCost, printCost, shippingCost };
    } catch (error) {
      logger.error("Error calculating order cost", error);
      throw new Error("Error calculating order cost");
    }
  }

  /**
   * Create a print order and optionally charge via Stripe
   */
  async createPrintOrder(userId, bookId, quantity, shippingAddress, shippingLevel) {
    try {
      const { totalCost } = await this.calculateOrderCost(
        bookId,
        quantity,
        shippingAddress,
        shippingLevel
      );

      const order = new PrintOrder({
        user: mongoose.Types.ObjectId(userId),
        book: mongoose.Types.ObjectId(bookId),
        quantity,
        shippingAddress,
        shippingLevel,
        totalCost,
        status: "pending",
      });

      await order.save();

      logger.info(`Print order created: ${order._id}`);

      return order;
    } catch (error) {
      logger.error("Error creating print order", error);
      throw new Error("Error creating print order");
    }
  }
}

module.exports = new PrintOrderService();
