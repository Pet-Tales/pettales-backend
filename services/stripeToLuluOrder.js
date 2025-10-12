const logger = require("../utils/logger");
const luluService = require("./luluService");
const printReadyPDFService = require("./printReadyPDFService");
const { Book } = require("../models");

async function createFromCheckout(session, meta = {}) {
  try {
    logger.info("🧾 Stripe→Lulu: Starting order creation", { sessionId: session.id });

    // Ensure we have metadata from Stripe checkout
    if (!meta.book_id || !meta.user_id) {
      logger.error("❌ Missing metadata from Stripe session");
      return;
    }

    // Fetch full book record for backup data
    const bookDoc = await Book.findById(meta.book_id).lean();

    // Map shipping address (Stripe → Lulu format)
    const shipping = mapAddress(session.customer_details, session.shipping_details);

    // Generate print-ready PDFs for Lulu
    const pdfs = await printReadyPDFService.generatePrintReadyPDFs(
      meta.book_id,
      meta.user_id
    );

    const orderData = {
      title: meta.book_title || bookDoc?.title || "Untitled Book",
      cover_pdf_url: pdfs.coverPdfUrl,
      interior_pdf_url: pdfs.interiorPdfUrl,
      shipping_address: shipping,
      shipping_level: "MAIL", // Lulu default
      quantity: 1,
      external_id: session.id,
    };

    logger.info("📦 Stripe→Lulu: Sending order data to Lulu", { orderData });

    const luluOrder = await luluService.createPrintJob(orderData);
    logger.info("✅ Lulu print order created successfully", { luluOrderId: luluOrder?.id });

    return luluOrder;
  } catch (err) {
    logger.error("❌ Failed to create order from checkout", { error: err.message, stack: err.stack });
    throw err;
  }
}

function mapAddress(customerDetails, shippingDetails) {
  const a = shippingDetails?.address || customerDetails?.address || {};
  return {
    name: (shippingDetails?.name || customerDetails?.name) ?? "",
    email: customerDetails?.email ?? "",
    phone_number: customerDetails?.phone ?? "",
    street1: a.line1 ?? "",
    street2: a.line2 ?? "",
    city: a.city ?? "",
    state_code: a.state || a.state_code || a.region || a.province || "",
    postcode: a.postal_code || a.postcode || "",
    country_code: a.country ?? "",
  };
}

module.exports = { createFromCheckout };
