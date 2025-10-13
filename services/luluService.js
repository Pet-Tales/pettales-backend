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
  async calculateOrderCost(bookId, quantity, shippingAddress, shippingLevel) {
    try {
      logger.info(
        `Calculating order cost for book ${bookId}, quantity: ${quantity}`
      );

      const book = await Book.findById(bookId);
      if (!book) throw new Error("Book not found");

      const pageCount = book.pageCount || 24;

      const shippingOptions = await luluService.getShippingOptions(
        shippingAddress,
        pageCount,
        quantity
      );

      const selectedOption = shippingOptions.find(
        (opt) => opt.level === shippingLevel
      );
      if (!selectedOption) throw new Error("Invalid shipping level");

      const luluCostData = await luluService.calculatePrintCost(
        shippingAddress,
        pageCount,
        quantity,
        shippingLevel
      );

      const printCost = Number(
        luluCostData.line_item_costs?.[0]?.total_cost_incl_tax || 0
      );
      const shippingCost = Number(
        luluCostData.shipping_cost?.total_cost_incl_tax || 0
      );
      const baseTotal = printCost + shippingCost;

      const totalWithMarkup =
        baseTotal *
        (1 + PRINT_MARKUP_PERCENTAGE / 100 + SHIPPING_MARKUP_PERCENTAGE / 100);

      return {
        total_cost_cents: Math.ceil(totalWithMarkup * 100),
        currency: luluCostData.currency || "GBP",
        breakdown: {
          printCost,
          shippingCost,
          baseTotal,
          totalWithMarkup,
        },
      };
    } catch (error) {
      logger.error("Error calculating order cost:", error.message);
      return {
        success: false,
        message: "Error calculating order cost",
        error: error.message,
      };
    }
  }

  async createPrintOrderAfterPayment(session) {
    try {
      const { book_id, user_id, quantity, shipping_level } = session.metadata;

      const book = await Book.findById(book_id);
      if (!book) throw new Error("Book not found");

      const pdfUrls = await printReadyPDFService.getFinalPDFUrls(book);
      const user = await User.findById(user_id);

      const shippingAddress = user?.shippingAddress;
      if (!shippingAddress)
        throw new Error("Missing shipping address for user");

      const orderData = {
        contact_email: user.email,
        shipping_address: shippingAddress,
        line_items: [
          {
            external_id: book._id.toString(),
            title: book.title,
            pod_package_id: luluService.podPackageId,
            printable_normalization: {
              interior: { source_url: pdfUrls.interior },
              cover: { source_url: pdfUrls.cover },
            },
            quantity: Number(quantity) || 1,
          },
        ],
      };

      const luluOrder = await luluService.createPrintJob(orderData);
      const printOrder = new PrintOrder({
        book: book._id,
        user: user._id,
        luluJobId: luluOrder.id,
        status: "submitted",
      });
      await printOrder.save();

      logger.info(`✅ Print order created for book ${book.title}`);
    } catch (error) {
      logger.error("Error creating print order:", error.message);
      throw error;
    }
  }
}

module.exports = new PrintOrderService();
