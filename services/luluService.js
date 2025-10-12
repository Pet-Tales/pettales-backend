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

    this.accessToken = null;
    this.tokenExpiry = null; // Timestamp in ms when the token expires
    this.podPackageId = LULU_POD_PACKAGE_ID; // From constants
  }

  /**
   * Helper method to create the Basic auth string for OAuth
   * @returns {string} - "Basic base64(client_id:client_secret)"
   */
  getBasicAuthHeader() {
    const credentials = `${LULU_CLIENT_KEY}:${LULU_CLIENT_SECRET}`;
    const base64Credentials = Buffer.from(credentials).toString("base64");
    return `Basic ${base64Credentials}`;
  }

  /**
   * Authenticate with Lulu OAuth 2.0 Client Credentials
   * Stores token and expiry internally to avoid frequent calls
   */
  async authenticate() {
    try {
      // Check if we have a valid token
      if (
        this.accessToken &&
        this.tokenExpiry &&
        Date.now() < this.tokenExpiry
      ) {
        return this.accessToken;
      }

      logger.info("Authenticating with Lulu API...");

      const tokenUrl = `${this.baseURL}/auth/realms/glasstree/protocol/openid-connect/token`;

      const response = await axios.post(
        tokenUrl,
        "grant_type=client_credentials",
        {
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            Authorization: this.getBasicAuthHeader(),
          },
        }
      );

      this.accessToken = response.data.access_token;
      // Set expiry to 5 minutes before actual expiry for safety
      this.tokenExpiry = Date.now() + (response.data.expires_in - 300) * 1000;

      logger.info("Successfully authenticated with Lulu API");
      return this.accessToken;
    } catch (error) {
      logger.error("Failed to authenticate with Lulu API:", error);
      throw new Error("Failed to authenticate with Lulu API");
    }
  }

  /**
   * Core method for making authenticated requests to Lulu API with retry logic
   */
  async makeRequest(method, endpoint, data = null, maxRetries = 2) {
    let retryCount = 0;
    let lastError = null;

    while (retryCount <= maxRetries) {
      try {
        const token = await this.authenticate();

        const url = `${this.baseURL}${endpoint}`;
        const headers = {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        };

        const config = {
          method,
          url,
          headers,
          data,
          timeout: 30000, // 30 seconds
        };

        logger.debug(`Making Lulu API request: ${method} ${endpoint}`, {
          attempt: retryCount + 1,
          maxRetries: maxRetries + 1,
        });

        const response = await axios(config);

        logger.debug(`Lulu API request successful: ${method} ${endpoint}`, {
          status: response.status,
          attempt: retryCount + 1,
        });

        return response.data;
      } catch (error) {
        lastError = error;

        const status = error?.response?.status;
        const errorData = error?.response?.data;

        logger.warn("Lulu API request failed", {
          attempt: retryCount + 1,
          status,
          error: error?.message,
          errorData,
        });

        // Retry on 5xx server errors or network timeouts
        if (
          status >= 500 ||
          error.code === "ECONNABORTED" ||
          error.message?.includes("timeout")
        ) {
          retryCount++;
          if (retryCount <= maxRetries) {
            const backoffMs = 1000 * retryCount; // Exponential-ish backoff
            logger.warn(`Retrying request after ${backoffMs}ms...`);
            await new Promise((r) => setTimeout(r, backoffMs));
            continue;
          }
        }

        // For non-retriable errors (4xx), break immediately
        break;
      }
    }

    // If we reach here, all attempts failed
    logger.error("Lulu API request permanently failed", {
      error: lastError?.message,
      response: lastError?.response?.data,
    });

    throw lastError || new Error("Lulu API request failed");
  }

  // ==================== COST & SHIPPING ====================

  /**
   * Calculate print cost using page_count + pod_package_id
   */
  async calculatePrintCost(
    pageCount,
    quantity,
    shippingAddress,
    shippingLevel
  ) {
    try {
      logger.info(
        `Calculating print cost for ${quantity} books with ${pageCount} pages`
      );

      // Validate inputs
      if (!pageCount || pageCount < 1) {
        throw new Error(`Invalid page count: ${pageCount}`);
      }
      if (!quantity || quantity < 1) {
        throw new Error(`Invalid quantity: ${quantity}`);
      }
      if (!this.podPackageId) {
        throw new Error("POD package ID not configured");
      }
      if (!shippingAddress) {
        throw new Error("Shipping address is required");
      }

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
        shipping_level: shippingLevel,
        currency: "GBP",
      };

      const result = await this.makeRequest(
        "POST",
        "/print-job-cost-calculations/",
        requestData
      );

      logger.info("Print cost calculation successful", {
        totalCostGBP: result.total_cost_incl_tax,
        currency: result.currency,
      });

      return result;
    } catch (error) {
      logger.error("Failed to calculate print cost:", error);
      throw new Error(error);
    }
  }

  /**
   * Get available shipping options for given destination & book spec
   */
  async getShippingOptions(shippingAddress, pageCount, quantity = 1) {
    try {
      logger.info(
        `Getting shipping options for ${shippingAddress.country_code}`
      );

      // Prepare request data according to Lulu API specification
      const requestData = {
        currency: "GBP", // Required field
        line_items: [
          {
            page_count: pageCount,
            pod_package_id: this.podPackageId,
            quantity: quantity,
          },
        ],
        shipping_address: {
          city: shippingAddress.city,
          country: shippingAddress.country_code, // Note: 'country' not 'country_code'
          postcode: shippingAddress.postcode,
          street1: shippingAddress.street1,
          // Only include state_code if it exists and is not empty
          ...(shippingAddress.state_code && {
            state_code: shippingAddress.state_code,
          }),
        },
      };

      const result = await this.makeRequest(
        "POST",
        "/shipping-options/",
        requestData
      );

      logger.info("Shipping options retrieved successfully", {
        count: result?.length || 0,
      });

      return result || [];
    } catch (error) {
      logger.error("Failed to get shipping options:", error);
      throw new Error(error);
    }
  }

  // ==================== PRINT JOB ====================

  /**
   * Create a print job
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
              cover: {
                source_url: printOrderData.cover_pdf_url,
              },
              interior: {
                source_url: printOrderData.interior_pdf_url,
              },
            },
            quantity: printOrderData.quantity,
          },
        ],
        shipping_address: printOrderData.shipping_address,
        shipping_level: printOrderData.shipping_level,
        contact_email: printOrderData.shipping_address.email,
      };

      const result = await this.makeRequest(
        "POST",
        "/print-jobs/",
        requestData
      );

      logger.info("Print job created successfully", {
        printJobId: result.id,
        externalId: printOrderData.external_id,
        status: result.status?.name,
      });

      return result;
    } catch (error) {
      logger.error("Failed to create print job:", error);
      throw new Error(error);
    }
  }

  // ==================== WEBHOOK MANAGEMENT METHODS ====================

  /**
   * Create a webhook subscription
   */
  async createWebhook(webhookUrl, topics = ["PRINT_JOB_STATUS_CHANGED"]) {
    try {
      logger.info("Creating webhook subscription", {
        url: webhookUrl,
        topics: topics,
      });

      const requestData = {
        url: webhookUrl,
        topics: topics,
      };

      const result = await this.makeRequest("POST", "/webhooks/", requestData);

      logger.info("Webhook created successfully", {
        webhookId: result?.id,
        url: result?.url,
        topics: result?.topics,
      });

      return result;
    } catch (error) {
      logger.error("Failed to create webhook:", error);
      throw new Error(error);
    }
  }

  /**
   * List all webhook subscriptions
   */
  async listWebhooks() {
    try {
      logger.info("Listing webhooks...");

      const result = await this.makeRequest("GET", "/webhooks/", null);

      logger.info("Webhooks listed successfully", {
        count: result?.length || 0,
      });

      return result || [];
    } catch (error) {
      logger.error("Failed to list webhooks:", error);
      throw new Error(error);
    }
  }

  /**
   * Delete a webhook by ID
   */
  async deleteWebhook(webhookId) {
    try {
      logger.info("Deleting webhook", { webhookId });

      await this.makeRequest("DELETE", `/webhooks/${webhookId}/`);

      logger.info("Webhook deleted successfully", { webhookId });

      return { success: true };
    } catch (error) {
      logger.error("Failed to delete webhook:", error);
      throw new Error(error);
    }
  }

  // ==================== COVER/INTERIOR VALIDATION HELPERS (optional) ====================

  async validateCover(coverPdfUrl) {
    try {
      const data = {
        pod_package_id: this.podPackageId,
        source_url: coverPdfUrl,
      };

      const result = await this.makeRequest("POST", "/validate-cover/", data);

      return result;
    } catch (error) {
      logger.error("Failed to validate cover PDF:", error);
      throw new Error(error);
    }
  }

  async validateInterior(interiorPdfUrl) {
    try {
      const data = {
        pod_package_id: this.podPackageId,
        source_url: interiorPdfUrl,
      };

      const result = await this.makeRequest(
        "POST",
        "/validate-interior/",
        data
      );

      return result;
    } catch (error) {
      logger.error("Failed to validate interior PDF:", error);
      throw new Error(error);
    }
  }

  async getCoverDimensions() {
    try {
      const data = {
        pod_package_id: this.podPackageId,
      };

      const result = await this.makeRequest("POST", "/cover-dimensions/", data);

      return result;
    } catch (error) {
      logger.error("Failed to get cover dimensions:", error);
      throw new Error(error);
    }
  }
}

module.exports = new LuluService();
