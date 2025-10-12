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

  // Prefer explicit USD cost if provided in metadata
  const luluCostUsd =
    meta.lulu_total_usd != null
      ? Number(meta.lulu_total_usd)
      : Number((amountTotalCents / 100).toFixed(2));

  // Your model expects credits = USD cents
  const totalCostCredits = Math.round(luluCostUsd * 100);

  const orderData = {
    user_id: meta.user_id || null,
    book_id: meta.book_id || null,

    shipping_address: addr,
    lulu_cost_usd: luluCostUsd,
    total_cost_credits: totalCostCredits,

    page_count: meta.page_count ? Number(meta.page_count) : undefined,
    shipping_level: meta.shipping_level || undefined,
    breakdown: {
      lulu_print_cost: meta.lulu_print_cost ? Number(meta.lulu_print_cost) : undefined,
      lulu_shipping_cost: meta.lulu_shipping_cost ? Number(meta.lulu_shipping_cost) : undefined,
      markup_percent: meta.markup_percent ? Number(meta.markup_percent) : undefined,
      stripe_session_id: session.id,
      stripe_payment_intent:
        typeof session.payment_intent === "string"
          ? session.payment_intent
          : session.payment_intent?.id,
    },
  };

  logger.info("🧾 Building Lulu PrintOrder from Stripe session", {
    sessionId: session.id,
    bookId: orderData.book_id,
    userId: orderData.user_id,
    luluCostUsd: orderData.lulu_cost_usd,
    totalCostCredits: orderData.total_cost_credits,
  });

  await printOrderService.createPrintOrder(orderData);
}

module.exports = { createFromCheckout };
