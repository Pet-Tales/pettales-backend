const axios = require("axios");
const logger = require("../utils/logger");
const { LULU_API_KEY, LULU_BASE_URL, LULU_POD_PACKAGE_ID } = require("../utils/constants");

class LuluService {
  constructor() {
    this.apiKey = LULU_API_KEY;
    this.baseUrl = LULU_BASE_URL;
    this.podPackageId = LULU_POD_PACKAGE_ID;
  }

  /**
   * Generic Lulu API request
   */
  async makeRequest(method, endpoint, data = null) {
    const url = `${this.baseUrl}${endpoint}`; // ✅ reverted to simple concatenation
    const headers = {
      Authorization: `Bearer ${this.apiKey}`,
      "Content-Type": "application/json",
    };

    try {
      const response = await axios({ method, url, headers, data });
      return response.data;
    } catch (error) {
      logger.error("Lulu API request failed:", error.response?.data || error.message);
      throw new Error(error.response?.data?.message || error.message);
    }
  }

  /**
   * Calculate print cost (used by printOrderService)
   */
  async calculatePrintCost(pageCount, quantity, shippingAddress, shippingLevel) {
    try {
      logger.info(`Calculating print cost for ${quantity} books with ${pageCount} pages`);

      if (!pageCount || pageCount < 1) throw new Error(`Invalid page count: ${pageCount}`);
      if (!quantity || quantity < 1) throw new Error(`Invalid quantity: ${quantity}`);
      if (!this.podPackageId) throw new Error("POD package ID not configured");
      if (!shippingAddress) throw new Error("Shipping address is required");

      const requestData = {
        line_items: [
          {
            page_count: pageCount,
            pod_package_id: this.podPackageId,
            quantity: quantity,
          },
        ],
        shipping_address: {
          name: shippingAddress.name,
          street1: shippingAddress.street1,
          street2: shippingAddress.street2 || "",
          city: shippingAddress.city,
          state_code: shippingAddress.state_code || "",
          postcode: shippingAddress.postcode,
          country_code: shippingAddress.country_code,
          phone_number: shippingAddress.phone_number,
          email: shippingAddress.email,
        },
        shipping_option: shippingLevel,
      };

      const result = await this.makeRequest(
        "POST",
        "print-job-cost-calculations/", // ✅ no leading slash
        requestData
      );

      logger.info("Print cost calculation successful", {
        totalCostGBP: result.total_cost_incl_tax,
        currency: result.currency,
      });

      // ✅ returns full Lulu JSON unchanged (used by printOrderService)
      return result;
    } catch (error) {
      logger.error("Failed to calculate print cost:", error);
      throw new Error(error);
    }
  }

  /**
   * Create print job (used after Stripe webhook)
   */
  async createPrintJob(printOrderData) {
    try {
      logger.info(`Creating print job for order ${printOrderData.external_id}`);

      const requestData = {
        external_id: printOrderData.external_id,
        line_items: [
          {
            external_id: `${printOrderData.external_id}_item_1`,
            title: printOrderData.title,
            printable_normalization: {
              pod_package_id: this.podPackageId,
              cover: { source_url: printOrderData.cover_pdf_url },
              interior: { source_url: printOrderData.interior_pdf_url },
            },
            quantity: printOrderData.quantity,
          },
        ],
        shipping_address: printOrderData.shipping_address,
        shipping_level: printOrderData.shipping_level,
        contact_email: printOrderData.shipping_address.email,
      };

      const result = await this.makeRequest("POST", "print-jobs/", requestData); // ✅ no leading slash

      logger.info("Print job created successfully", {
        printJobId: result.id,
        externalId: printOrderData.external_id,
        status: result.status?.name,
      });

      return result;
    } catch (error) {
      logger.error("Failed to create print job:", error.message);
      throw new Error("Failed to create print job");
    }
  }
}

module.exports = new LuluService();
