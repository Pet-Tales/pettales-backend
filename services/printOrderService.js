const { PrintOrder } = require("../models");
const luluService = require("./luluService");
const logger = require("../utils/logger");

class PrintOrderService {
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
        "total_cost_credits",
      ];

      for (const field of required) {
        const parts = field.split(".");
        let value = data;
        for (const part of parts) value = value?.[part];
        if (!value) throw new Error(`Missing required field: ${field}`);
      }

      // Create record in DB first
      const printOrder = await PrintOrder.create({
        ...data,
        status: "initiated",
      });

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
