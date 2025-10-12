// services/stripeToLuluOrder.js
const logger = require("../utils/logger");
const luluService = require("./luluService");
const printReadyPDFService = require("./printReadyPDFService");
const { Book } = require("../models");

async function createFromCheckout(session, meta = {}) {
  try {
    logger.info("🧾 Stripe→Lulu: Starting order creation", { sessionId: session.id });

    if (!meta.book_id || !meta.user_id) {
      logger.error("❌ Missing metadata from Stripe session");
      return;
    }

    const book = await Book.findById(meta.book_id);
    if (!book) throw new Error(`Book not found: ${meta.book_id}`);

    const pdfs = await printReadyPDFService.generatePrintReadyPDFs(
      meta.book_id,
      meta.user_id
    );

    const addr = session?.shipping_details?.address || {};
    const recipient = {
      name: session?.shipping_details?.name || session?.customer_details?.name || "",
      email: session?.customer_details?.email || "",
      phone_number: session?.customer_details?.phone || "",
      street1: addr.line1 || "",
      street2: addr.line2 || "",
      city: addr.city || "",
      state_code: addr.state || addr.region || "",
      postcode: addr.postal_code || "",
      country_code: addr.country || "GB",
    };

    const orderData = {
      title: book.title || "Pet Tales Book",
      package_id: process.env.LULU_POD_PACKAGE_ID,
      recipient,
      shipping_level: meta.shipping_level || "MAIL",
      quantity: Number(meta.quantity) || 1,
      external_id: session.id,
      line_items: [
        {
          title: book.title || "Untitled Book",
          cover_pdf: pdfs.coverPdfUrl,
          interior_pdf: pdfs.interiorPdfUrl,
          page_count: book.page_count || 12,
        },
      ],
    };

    logger.info("📦 Sending order to Lulu", { orderData });
    const luluOrder = await luluService.createPrintJob(orderData);
    logger.info("✅ Lulu order created successfully", { luluOrderId: luluOrder?.id });

    return luluOrder;
  } catch (err) {
    logger.error("❌ Failed to create Lulu order", { error: err.message, stack: err.stack });
    throw err;
  }
}

module.exports = { createFromCheckout };
