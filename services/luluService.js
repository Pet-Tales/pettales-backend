const axios = require("axios");
const logger = require("../utils/logger");
const {
  LULU_CLIENT_KEY,
  LULU_CLIENT_SECRET,
  LULU_API_BASE_URL,
  LULU_SANDBOX_API_BASE_URL,
  LULU_ENVIRONMENT,
  LULU_POD_PACKAGE_ID,
} = require("../utils/constants");

class LuluService {
  constructor() {
    this.baseURL =
      LULU_ENVIRONMENT === "production"
        ? LULU_API_BASE_URL
        : LULU_SANDBOX_API_BASE_URL;
    this.podPackageId = LULU_POD_PACKAGE_ID;
    this.accessToken = null;
    this.tokenExpiry = null;
  }

  async authenticate() {
    try {
      const url =
        "https://auth.lulu.com/auth/realms/glasstree/protocol/openid-connect/token";

      const form = new URLSearchParams();
      form.append("grant_type", "client_credentials");
      form.append("client_id", LULU_CLIENT_KEY);
      form.append("client_secret", LULU_CLIENT_SECRET);

      const { data } = await axios.post(url, form.toString(), {
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
      });

      this.accessToken = data.access_token;
      this.tokenExpiry = Date.now() + data.expires_in * 1000;
      logger.info("✅ Lulu authentication successful");
    } catch (error) {
      logger.error("❌ Lulu authentication failed", error.message);
      throw new Error("Failed to authenticate with Lulu");
    }
  }

  async makeRequest(method, endpoint, data = null, retryCount = 0) {
    if (!this.accessToken || Date.now() >= this.tokenExpiry) {
      await this.authenticate();
    }

    const url = `${this.baseURL}${endpoint}`;
    try {
      const response = await axios({
        method,
        url,
        data,
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          "Content-Type": "application/json",
        },
      });
      return response.data;
    } catch (error) {
      const status = error.response?.status;
      if ((status === 401 || status === 403) && retryCount < 1) {
        await this.authenticate();
        return this.makeRequest(method, endpoint, data, retryCount + 1);
      }
      logger.error(`❌ Lulu API error on ${endpoint}: ${error.message}`);
      throw error;
    }
  }

  // ✅ Restored function
  async getShippingOptions(shippingAddress, pageCount, quantity) {
    try {
      const data = {
        line_items: [
          {
            page_count: pageCount,
            pod_package_id: this.podPackageId,
            quantity,
          },
        ],
        shipping_address: shippingAddress,
      };

      const result = await this.makeRequest(
        "post",
        "/shipping-options/",
        data
      );

      return result;
    } catch (error) {
      console.error("❌ Error fetching shipping options:", error.message);
      throw new Error("Failed to fetch shipping options from Lulu");
    }
  }

  async calculatePrintCost(shippingAddress, pageCount, quantity, shippingLevel) {
    try {
      const data = {
        line_items: [
          {
            page_count: pageCount,
            pod_package_id: this.podPackageId,
            quantity,
          },
        ],
        shipping_address: shippingAddress,
        shipping_level: shippingLevel,
      };

      const result = await this.makeRequest(
        "post",
        "/print-job-cost-calculations/",
        data
      );
      return result;
    } catch (error) {
      logger.error("Error calculating Lulu print cost:", error.message);
      throw new Error("Error calculating Lulu print cost");
    }
  }

  async createPrintJob(orderData) {
    try {
      logger.info("📦 Sending print job to Lulu");
      const result = await this.makeRequest("post", "/print-jobs/", orderData);
      logger.info("✅ Print job successfully submitted to Lulu");
      return result;
    } catch (error) {
      logger.error("Error creating Lulu print job:", error.message);
      throw new Error("Failed to create print job");
    }
  }

  async getPrintJobStatus(printJobId) {
    try {
      const result = await this.makeRequest(
        "get",
        `/print-jobs/${printJobId}/`
      );
      return result;
    } catch (error) {
      logger.error("Error fetching Lulu print job status:", error.message);
      throw new Error("Failed to fetch print job status");
    }
  }
}

module.exports = new LuluService();
