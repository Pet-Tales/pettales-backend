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
   * Calculate cost for a Lulu print order
   */
  async calculateCost(productId, quantity) {
    try {
      const response = await axios.post(
        `${this.baseUrl}/calculate`,
        {
          product_id: productId,
          quantity,
          package_id: this.podPackageId,
        },
        {
          headers: {
            "Authorization": `Bearer ${this.apiKey}`,
            "Content-Type": "application/json",
          },
        }
      );

      if (!response.data || !response.data.cost) {
        throw new Error("Invalid response from Lulu API");
      }

      return response.data.cost;
    } catch (error) {
      logger.error("Error calculating Lulu cost", error);
      throw new Error("Error calculating Lulu cost");
    }
  }

  /**
   * Create a Lulu print order
   */
  async createOrder(orderDetails) {
    try {
      const response = await axios.post(
        `${this.baseUrl}/orders`,
        orderDetails,
        {
          headers: {
            "Authorization": `Bearer ${this.apiKey}`,
            "Content-Type": "application/json",
          },
        }
      );

      if (!response.data || !response.data.order_id) {
        throw new Error("Invalid response from Lulu API");
      }

      logger.info(`Lulu order created: ${response.data.order_id}`);
      return response.data;
    } catch (error) {
      logger.error("Error creating Lulu order", error);
      throw new Error("Error creating Lulu order");
    }
  }
}

module.exports = new LuluService();
