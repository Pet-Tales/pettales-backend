const printOrderService = require("./printOrderService");
const logger = require("../utils/logger");

async function createFromCheckout(session) {
  try {
    logger.info(`Processing Stripe session ${session.id} for Lulu print`);
    await printOrderService.createPrintOrderAfterPayment(session);
    logger.info("✅ Lulu print job created after Stripe payment");
  } catch (error) {
    logger.error("❌ Failed to create Lulu print order:", error.message);
  }
}

module.exports = { createFromCheckout };
