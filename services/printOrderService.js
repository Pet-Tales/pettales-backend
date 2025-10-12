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

/**
 * Utilities
 */
const toCents = (num) => Math.round(Number(num || 0) * 100);
const centsToFloat = (c) => Math.round(c) / 100;

/**
 * PrintOrderService:
 * - Calculates Lulu print + shipping cost (with markup)
 * - Creates Stripe Checkout at the exact computed total
 * - On payment success (webhook), generates PDFs and submits a Lulu print job
 */
class PrintOrderService {
  /**
   * Calculate order cost using Lulu (print + shipping) and apply markup.
   * Returns a shape with both cents and floats for convenience.
   */
  async calculateOrderCost(bookId, quantity, shippingAddress, shippingLevel) {
    try {
      logger.info(
        `Calculating Lulu costs for book=${bookId} qty=${quantity} level=${shippingLevel}`
      );

      const book = await Book.findById(bookId);
      if (!book) throw new Error("Book not found");

      // 1) Base costs from Lulu
      const luluCost = await luluService.calculateCost({
        pageCount: book.page_count || book.pageCount || 12,
        quantity,
        shippingLevel,
        shippingAddress,
      });
      // Expecting: { print_cost: number, shipping_cost: number, currency: 'usd'|'gbp'... }
      if (!luluCost || luluCost.print_cost == null || luluCost.shipping_cost == null) {
        throw new Error("Lulu cost API returned invalid data");
      }

      // 2) Apply markups
      const printMarkupMult = 1 + (PRINT_MARKUP_PERCENTAGE || 0) / 100;
      const shipMarkupMult = 1 + (SHIPPING_MARKUP_PERCENTAGE || 0) / 100;

      const printCostCents = toCents(luluCost.print_cost);
      const shipCostCents = toCents(luluCost.shipping_cost);

      const printWithMarkupCents = Math.round(printCostCents * printMarkupMult);
      const shipWithMarkupCents = Math.round(shipCostCents * shipMarkupMult);

      const total_cents = printWithMarkupCents + shipWithMarkupCents;

      return {
        currency: (luluCost.currency || CURRENCY || "usd").toLowerCase(),
        quantity,
        lulu_print_cost_cents: printCostCents,
        lulu_shipping_cost_cents: shipCostCents,
        print_markup_percent: PRINT_MARKUP_PERCENTAGE || 0,
        shipping_markup_percent: SHIPPING_MARKUP_PERCENTAGE || 0,
        total_cost_cents: total_cents,

        // helpful floats for UI/logs
        lulu_print_cost: centsToFloat(printCostCents),
        lulu_shipping_cost: centsToFloat(shipCostCents),
        total_cost: centsToFloat(total_cents),
      };
    } catch (err) {
      logger.error(`calculateOrderCost failed: ${err.stack || err.message}`);
      throw err;
    }
  }

  /**
   * Controller calls this to start the Stripe Checkout flow for printing.
   * It MUST be wired to POST /api/print-orders/create-checkout.
   */
  async createPrintOrderCheckout({
    userId,
    bookId,
    quantity = 1,
    shippingLevel,
    shippingAddress,
  }) {
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
      const user = await User.findById(userId).session(session);
      if (!user) throw new Error("User not found");

      const book = await Book.findById(bookId).session(session);
      if (!book) throw new Error("Book not found");

      // 1) Calculate Lulu cost w/ markups
      const cost = await this.calculateOrderCost(
        bookId,
        quantity,
        shippingAddress,
        shippingLevel
      );

      // 2) Prepare metadata for webhook reconstruction
      const metadata = {
        type: "book_print",
        book_id: String(book._id),
        user_id: String(user._id),
        page_count: String(book.page_count || book.pageCount || 12),
        quantity: String(quantity),
        shipping_level: String(shippingLevel || ""),
        shipping_country: String(shippingAddress?.country || ""),
        shipping_city: String(shippingAddress?.city || ""),
        shipping_state: String(shippingAddress?.state || ""),
        shipping_postal_code: String(shippingAddress?.postal_code || shippingAddress?.postalCode || ""),

        lulu_print_cost: String(cost.lulu_print_cost), // floats for human read
        lulu_shipping_cost: String(cost.lulu_shipping_cost),
        print_markup: String(cost.print_markup_percent),
        shipping_markup: String(cost.shipping_markup_percent),
        currency: String(cost.currency),
      };

      // 3) Create Stripe Checkout at the exact computed total
      const checkoutUrl = await stripeService.createPrintCheckoutSession(
        String(book._id),
        cost.total_cost_cents,
        String(user._id),
        user.email,
        metadata,
        cost.currency
      );

      await session.commitTransaction();
      return { url: checkoutUrl };
    } catch (err) {
      await session.abortTransaction();
      logger.error(`createPrintOrderCheckout failed: ${err.stack || err.message}`);
      throw err;
    } finally {
      session.endSession();
    }
  }

  /**
   * Webhook path: called on checkout.session.completed (type === book_print).
   * Rebuild order data from the session + metadata, generate PDFs, submit Lulu job,
   * and persist PrintOrder with Lulu job ID.
   */
  async processPrintPaymentSuccess(stripeSession) {
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
      const meta = stripeSession.metadata || {};
      const userId = meta.user_id;
      const bookId = meta.book_id;

      const user = await User.findById(userId).session(session);
      if (!user) throw new Error("User not found on webhook");

      const book = await Book.findById(bookId).session(session);
      if (!book) throw new Error("Book not found on webhook");

      // Stripe shipping address (if using Checkout shipping address collection)
      // Fallback to metadata when absent.
      const ship = stripeSession.shipping?.address || {};
      const shippingAddress = {
        name: stripeSession.customer_details?.name || user.name || "",
        address1: ship.line1 || "",
        address2: ship.line2 || "",
        city: ship.city || meta.shipping_city || "",
        state: ship.state || meta.shipping_state || "",
        postal_code: ship.postal_code || meta.shipping_postal_code || "",
        country: ship.country || meta.shipping_country || "",
        email: stripeSession.customer_details?.email || user.email,
        phone: stripeSession.customer_details?.phone || "",
      };

      const orderData = {
        user: user._id,
        book: book._id,
        quantity: Number(meta.quantity || 1),
        page_count: Number(meta.page_count || book.page_count || 12),
        shipping_level: meta.shipping_level || "",
        shipping_address: shippingAddress,
        currency: (meta.currency || "usd").toLowerCase(),
        stripe_session_id: stripeSession.id,
        stripe_payment_intent: stripeSession.payment_intent || null,
        // Prices (for record)
        lulu_print_cost: Number(meta.lulu_print_cost || 0),
        lulu_shipping_cost: Number(meta.lulu_shipping_cost || 0),
        print_markup_percent: Number(meta.print_markup || 0),
        shipping_markup_percent: Number(meta.shipping_markup || 0),
        total_amount: (stripeSession.amount_total != null)
          ? centsToFloat(stripeSession.amount_total)
          : null,
        status: "paid",
      };

      const created = await this.createPrintOrder(user._id, orderData, stripeSession.id, session);

      await session.commitTransaction();
      logger.info(`Print order processed successfully. OrderId=${created?._id}`);
      return created;
    } catch (err) {
      await session.abortTransaction();
      logger.error(`processPrintPaymentSuccess failed: ${err.stack || err.message}`);
      throw err;
    } finally {
      session.endSession();
    }
  }

  /**
   * Create DB PrintOrder, generate print-ready PDFs, submit Lulu print job,
   * update order with Lulu job ID and artifact URLs.
   */
  async createPrintOrder(userId, orderData, stripeSessionId = null, session = null) {
    const ownsSession = !session;
    if (ownsSession) {
      session = await mongoose.startSession();
      session.startTransaction();
    }

    try {
      // 1) Persist initial order
      const order = await PrintOrder.create(
        [
          {
            user: userId,
            book: orderData.book,
            quantity: orderData.quantity,
            page_count: orderData.page_count,
            shipping_level: orderData.shipping_level,
            shipping_address: orderData.shipping_address,
            currency: orderData.currency,
            stripe_session_id: stripeSessionId,
            stripe_payment_intent: orderData.stripe_payment_intent || null,
            lulu_print_cost: orderData.lulu_print_cost,
            lulu_shipping_cost: orderData.lulu_shipping_cost,
            print_markup_percent: orderData.print_markup_percent,
            shipping_markup_percent: orderData.shipping_markup_percent,
            total_amount: orderData.total_amount,
            status: "preparing",
          },
        ],
        { session }
      ).then((arr) => arr[0]);

      // 2) Generate print-ready PDFs for Lulu (cover + interior)
      const { coverPdfUrl, interiorPdfUrl } =
        await this.generatePrintReadyPDFs(order.book, userId, order._id);

      // 3) Submit Lulu print job
      const luluJob = await luluService.createPrintJob({
        orderId: String(order._id),
        quantity: order.quantity,
        pageCount: order.page_count,
        currency: order.currency,
        shippingLevel: order.shipping_level,
        shippingAddress: order.shipping_address,
        coverPdfUrl,
        interiorPdfUrl,
      });

      // 4) Update order with Lulu job details
      order.cover_pdf_url = coverPdfUrl;
      order.interior_pdf_url = interiorPdfUrl;
      order.lulu_print_job_id = luluJob?.id || luluJob?.job_id || null;
      order.status = luluJob ? "submitted" : "failed_submit";
      await order.save({ session });

      if (ownsSession) await session.commitTransaction();
      logger.info(
        `Lulu print job submitted. order=${order._id} lulu_job=${order.lulu_print_job_id}`
      );
      return order;
    } catch (err) {
      if (ownsSession) await session.abortTransaction();
      logger.error(`createPrintOrder failed: ${err.stack || err.message}`);
      throw err;
    } finally {
      if (ownsSession) session.endSession();
    }
  }

  /**
   * Generate print-ready PDFs for Lulu. Returns S3 (or CDN) URLs.
   */
  async generatePrintReadyPDFs(bookId, userId, orderId) {
    try {
      logger.info(
        `Generating print-ready PDFs for book=${bookId} user=${userId} order=${orderId}`
      );

      const result = await printReadyPDFService.generate({
        bookId,
        userId,
        orderId,
      });
      // Expecting: { coverPdfUrl, interiorPdfUrl }
      if (!result || !result.coverPdfUrl || !result.interiorPdfUrl) {
        throw new Error("printReadyPDFService returned invalid data");
      }
      return result;
    } catch (err) {
      logger.error(`generatePrintReadyPDFs failed: ${err.stack || err.message}`);
      throw err;
    }
  }
}

module.exports = new PrintOrderService();
