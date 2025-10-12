// services/printOrderService.js
const mongoose = require("mongoose");
const { PrintOrder, Book, User } = require("../models");
const luluService = require("./luluService");
const stripeService = require("./stripeService");
const printReadyPDFService = require("./printReadyPDFService");
const logger = require("../utils/logger");
const {
  PRINT_MARKUP_PERCENTAGE,
  SHIPPING_MARKUP_PERCENTAGE,
  CURRENCY, // e.g. "usd" or "gbp"
} = require("../utils/constants");

const toCents = (num) => Math.round(Number(num || 0) * 100);
const centsToFloat = (c) => Math.round(Number(c) || 0) / 100;

class PrintOrderService {
  /**
   * 🔹 Dynamically calculate Lulu print + shipping cost with markups
   *     (Uses the exact response shape from the last working backend)
   */
  async calculateOrderCost(bookId, quantity, shippingAddress, shippingLevel) {
    try {
      logger.info(
        `Calculating Lulu costs for book=${bookId}, qty=${quantity}, level=${shippingLevel}`
      );

      const book = await Book.findById(bookId);
      if (!book) throw new Error("Book not found");

      // --- Call Lulu for live cost ---
      const luluCost = await luluService.calculatePrintCost(
        book.page_count || book.pageCount || 12,
        quantity,
        shippingAddress,
        shippingLevel
      );

      // ✅ Use the same keys as the previously working version
      const rawPrint = parseFloat(
        luluCost.line_item_costs?.[0]?.total_cost_incl_tax || 0
      );
      const rawShip = parseFloat(
        luluCost.shipping_cost?.total_cost_incl_tax || 0
      );
      const rawTotal = parseFloat(luluCost.total_cost_incl_tax || 0);

      // Validate
      if (!rawPrint || rawPrint <= 0) {
        logger.error("❌ Invalid Lulu print cost data", { luluCost });
        throw new Error("Lulu cost API returned invalid data");
      }

      const currency = (luluCost.currency || CURRENCY || "GBP").toLowerCase();

      // --- Apply markups (same logic as before-fix version) ---
      const printMarkupPct = PRINT_MARKUP_PERCENTAGE || 100;
      const shipMarkupPct = SHIPPING_MARKUP_PERCENTAGE || 5;

      const printCents = toCents(rawPrint);
      const shipCents = toCents(rawShip);

      const printWithMarkup = Math.round(
        printCents * (1 + printMarkupPct / 100)
      );
      const shipWithMarkup = Math.round(
        shipCents * (1 + shipMarkupPct / 100)
      );

      const total_cents = printWithMarkup + shipWithMarkup;

      // --- Return in same shape used by Stripe service ---
      return {
        currency,
        lulu_print_cost_cents: printCents,
        lulu_shipping_cost_cents: shipCents,
        total_cost_cents: total_cents,
        lulu_print_cost: centsToFloat(printCents),
        lulu_shipping_cost: centsToFloat(shipCents),
        total_cost: centsToFloat(total_cents),
      };
    } catch (err) {
      logger.error(`calculateOrderCost failed: ${err.stack || err.message}`);
      throw err;
    }
  }
}

module.exports = new PrintOrderService();
