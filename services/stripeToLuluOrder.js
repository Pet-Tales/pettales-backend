const printOrderService = require("./printOrderService");
const logger = require("../utils/logger");

const val = (v, fb = "") => (v == null ? fb : v);

function mapAddress(customerDetails, shippingDetails) {
  const a = shippingDetails?.address || customerDetails?.address || {};
  return {
    name: val(shippingDetails?.name || customerDetails?.name),
    email: val(customerDetails?.email),
    phone_number: val(customerDetails?.phone),
    street1: val(a.line1),
    street2: val(a.line2),
    city: val(a.city),
    state: val(a.state),
    postcode: val(a.postal_code),
    country_code: val(a.country),
  };
}

async function createFromCheckout(session) {
  const cd = session.customer_details || {};
  const sd = session.shipping_details || {};
  const addr = mapAddress(cd, sd);
  const meta = session.metadata || {};

  const amountTotalCents = Number(session.amount_total || 0);
  const luluCostUsd =
    meta.lulu_total_usd != null
      ? Number(meta.lulu_total_usd)
      : Number((amountTotalCents / 100).toFixed(2));

  // 🔹 Build the correct structure for printOrderService
  const orderData = {
    user_id: meta.user_id || null,
    book_id: meta.book_id || null,
    page_count: meta.page_count ? Number(meta.page_count) : undefined,
    quantity: 1,
    shipping_level: meta.shipping_level || undefined,
    shipping_address: addr,
    currency: session.currency?.toUpperCase() || "GBP",
    lulu_cost_usd: luluCostUsd,
    total_cost_usd: luluCostUsd, // unified cost field
    cost_breakdown: {
      lulu_print_cost: meta.lulu_print_cost
        ? Number(meta.lulu_print_cost)
        : undefined,
      lulu_shipping_cost: meta.lulu_shipping_cost
        ? Number(meta.lulu_shipping_cost)
        : undefined,
      markup_percent: meta.markup_percent
        ? Number(meta.markup_percent)
        : undefined,
      stripe_session_id: session.id,
      stripe_payment_intent:
        typeof session.payment_intent === "string"
          ? session.payment_intent
          : session.payment_intent?.id,
    },
  };

  logger.info("🧾 Stripe→Lulu order data built", {
    bookId: orderData.book_id,
    userId: orderData.user_id,
    totalCost: orderData.total_cost_usd,
  });

  await printOrderService.createPrintOrder(orderData);

  logger.info("✅ Stripe checkout → Lulu print order created successfully");
}

module.exports = { createFromCheckout };
