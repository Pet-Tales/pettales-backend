const { PrintOrder, Book } = require("../models");
const luluService = require("./luluService");
const logger = require("../utils/logger");
const {
  PRINT_MARKUP_PERCENTAGE,
  SHIPPING_MARKUP_PERCENTAGE,
} = require("../utils/constants");

class PrintOrderService {
  /**
   * Calculate order cost (no credits; applies print + shipping markups)
   */
  async calculateOrderCost(bookId, quantity, shippingAddress, shippingLevel) {
    try {
      logger.info("Calculating order cost", {
        bookId,
        quantity,
        shippingLevel,
        country: shippingAddress?.country_code,
      });

      // 1) Book
      const book = await Book.findById(bookId);
      if (!book) throw new Error("Book not found");

      // 2) Validate shipping level for destination
      const options = await luluService.getShippingOptions(
        shippingAddress,
        book.page_count,
        quantity
      );

      const wanted = options.find((o) => o.level === shippingLevel);
      if (!wanted) {
        const levels = options.map((o) => o.level);
        throw new Error(
          `Shipping level "${shippingLevel}" is not available for ${shippingAddress?.country_code}. Available: ${levels.join(", ") || "None"}`
        );
      }

      // 3) Lulu cost calc (currency set in luluService; defaults to GBP there)
      const luluCost = await luluService.calculatePrintCost(
        book.page_count,
        quantity,
        shippingAddress,
        shippingLevel
      );

      // Lulu fields (names follow Lulu API payload)
      const luluPrintCost = parseFloat(
        luluCost.print_cost_incl_tax ?? luluCost.print_cost ?? 0
      );
      const luluShippingCost = parseFloat(
        luluCost.shipping_cost_incl_tax ?? luluCost.shipping_cost ?? 0
      );
      const luluCostTotal = parseFloat(luluCost.total_cost_incl_tax ?? 0);
      const currency = luluCost.currency || "GBP";

      // Markups
      const printMarkupPct = Number.isFinite(PRINT_MARKUP_PERCENTAGE)
        ? PRINT_MARKUP_PERCENTAGE
        : 100;
      const shippingMarkupPct = Number.isFinite(SHIPPING_MARKUP_PERCENTAGE)
        ? SHIPPING_MARKUP_PERCENTAGE
        : 5;

      const totalWithMarkup =
        luluPrintCost * (1 + printMarkupPct / 100) +
        luluShippingCost * (1 + shippingMarkupPct / 100);

      const costBreakdown = {
        // public fields
        book_id: bookId,
        book_title: book.title,
        page_count: book.page_count,
        quantity,
        shipping_level: shippingLevel,
        currency,
        total_cost_usd: totalWithMarkup, // name kept for backward compatibility; actually your configured currency
        cost_breakdown: {
          line_items: luluCost.line_item_costs,
          shipping: luluCost.shipping_cost,
          fulfillment: luluCost.fulfillment_cost,
          fees: luluCost.fees || [],
        },

        // internal fields (controller strips these before sending to FE)
        lulu_cost_usd: luluCostTotal,
        lulu_print_cost: luluPrintCost,
        lulu_shipping_cost: luluShippingCost,
        print_markup_percentage: printMarkupPct,
        shipping_markup_percentage: shippingMarkupPct,
      };

      logger.info("✅ Order cost calculated", {
        total: totalWithMarkup,
        currency,
      });

      return costBreakdown;
    } catch (err) {
      logger.error("Failed to calculate order cost:", err?.message || err);
      throw new Error(String(err?.message || err).replace("Error: ", ""));
    }
  }

  /**
   * Create Lulu print order (used by Stripe webhook build in services/stripeToLuluOrder.js)
   */
  async createPrintOrder(data) {
    try {
      logger.info("Creating print order:", data);

      // basic validation
      const required = [
        "shipping_address.email",
        "shipping_address.phone_number",
        "shipping_address.postcode",
        "shipping_address.street1",
        "lulu_cost_usd",
        "total_cost_usd",
        "book_id",
        "page_count",
        "quantity",
        "shipping_level",
      ];

      const missing = required.filter((key) => {
        const parts = key.split(".");
        let cur = data;
        for (const p of parts) {
          cur = cur?.[p];
        }
        return cur == null || cur === "";
      });

      if (missing.length > 0) {
        throw new Error(
          `Missing required fields: ${missing.join(", ")}`
        );
      }

      // Build PrintOrder doc
      const printOrder = new PrintOrder({
        user_id: data.user_id || null,
        book_id: data.book_id,
        page_count: data.page_count,
        quantity: data.quantity,
        shipping_level: data.shipping_level,
        shipping_address: data.shipping_address,
        currency: data.currency || "GBP",
        lulu_cost_usd: data.lulu_cost_usd,
        total_cost_usd: data.total_cost_usd,
        cost_breakdown: data.cost_breakdown || {},
        status: "queued",
      });

      await printOrder.save();

      // Send to Lulu
      await luluService.createPrintJob(printOrder);

      logger.info("✅ Lulu print order created successfully");
      return printOrder;
    } catch (err) {
      logger.error("❌ Failed to create print order:", err.message);
      throw err;
    }
  }
}

module.exports = new PrintOrderService();
