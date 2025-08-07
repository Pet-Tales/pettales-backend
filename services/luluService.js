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

  /**
   * Generate Basic Auth header for token request
   */
  getBasicAuthHeader() {
    const credentials = Buffer.from(
      `${LULU_CLIENT_KEY}:${LULU_CLIENT_SECRET}`
    ).toString("base64");
    return `Basic ${credentials}`;
  }

  /**
   * Authenticate with Lulu API and get access token
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
      logger.error(
        "Failed to authenticate with Lulu API:",
        error.response?.data || error.message
      );
      throw new Error("Lulu API authentication failed");
    }
  }

  /**
   * Make authenticated request to Lulu API with retry logic
   */
  async makeRequest(method, endpoint, data = null, retryCount = 0) {
    const maxRetries = 3;
    const retryDelay = Math.pow(2, retryCount) * 1000; // Exponential backoff

    try {
      const token = await this.authenticate();

      const config = {
        method,
        url: `${this.baseURL}${endpoint}`,
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        timeout: 30000, // 30 second timeout
      };

      if (data) {
        config.data = data;
      }

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
      const isRetryable = this.isRetryableError(error);
      const shouldRetry = retryCount < maxRetries && isRetryable;

      // Enhanced error logging

      logger.error(`Lulu API request failed: ${method} ${endpoint}`, {
        error: error.response?.data || error.message,
        status: error.response?.status,
        statusText: error.response?.statusText,
        headers: error.response?.headers,
        attempt: retryCount + 1,
        maxRetries: maxRetries + 1,
        isRetryable,
        willRetry: shouldRetry,
        requestData: data ? JSON.stringify(data, null, 2) : null,
      });

      if (shouldRetry) {
        logger.info(`Retrying Lulu API request in ${retryDelay}ms`, {
          method,
          endpoint,
          attempt: retryCount + 2,
        });

        await new Promise((resolve) => setTimeout(resolve, retryDelay));
        return this.makeRequest(method, endpoint, data, retryCount + 1);
      }

      // Extract detailed error message from Lulu response
      let detailedMessage = error.message;

      if (error.response?.data) {
        const luluError = error.response.data;

        // Handle shipping address validation errors
        if (luluError.shipping_address?.detail?.errors) {
          const errors = luluError.shipping_address.detail.errors;
          const errorMessages = errors.map((err) => `${err.message}`);
          detailedMessage = errorMessages.join("; ");
        }
        // Handle other structured errors
        else if (luluError.detail) {
          detailedMessage = luluError.detail;
        }
        // Handle simple message errors
        else if (luluError.message) {
          detailedMessage = luluError.message;
        }
      }

      // Enhance error with more context
      const enhancedError = new Error(detailedMessage);
      // enhancedError.status = error.response?.status;
      // enhancedError.originalError = error;
      // enhancedError.luluResponse = error.response?.data;

      throw enhancedError;
    }
  }

  /**
   * Check if error is retryable
   */
  isRetryableError(error) {
    // Retry on network errors
    if (!error.response) {
      return true;
    }

    const status = error.response.status;

    // Retry on server errors (5xx) and rate limiting (429)
    if (status >= 500 || status === 429) {
      return true;
    }

    // Retry on authentication errors (token might have expired)
    if (status === 401) {
      this.accessToken = null; // Clear cached token
      return true;
    }

    // Don't retry on client errors (4xx except 401 and 429)
    return false;
  }

  /**
   * Get available shipping options for a destination
   */
  async getShippingOptions(shippingAddress, pageCount, quantity = 1) {
    try {
      logger.info(
        `Getting shipping options for ${shippingAddress.country_code}`
      );

      // Prepare request data according to Lulu API specification
      const requestData = {
        currency: "USD", // Required field
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

      logger.info("Lulu shipping options request", {
        country: shippingAddress.country_code,
        city: shippingAddress.city,
        pageCount,
        quantity,
        podPackageId: this.podPackageId,
        requestData: JSON.stringify(requestData, null, 2),
      });

      const result = await this.makeRequest(
        "POST",
        "/shipping-options/",
        requestData
      );

      logger.info("Shipping options retrieved successfully", {
        country: shippingAddress.country_code,
        optionsCount: result?.length || 0,
      });

      // The response is directly an array of shipping options
      return result || [];
    } catch (error) {
      logger.error("Failed to get shipping options:", {
        error: error.message,
        status: error.response?.status,
        statusText: error.response?.statusText,
        responseData: error.response?.data,
        country: shippingAddress.country_code,
      });
      throw new Error(`Failed to get shipping options: ${error.message}`);
    }
  }

  /**
   * Calculate print job cost
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
        shipping_option: shippingLevel,
      };

      const result = await this.makeRequest(
        "POST",
        "/print-job-cost-calculations/",
        requestData
      );

      logger.info("Print cost calculation successful", {
        totalCostUSD: result.total_cost_incl_tax,
        currency: result.currency,
      });

      return result;
    } catch (error) {
      logger.error("Failed to calculate print cost:", error);
      // throw new Error("Failed to calculate print cost");
      throw new Error(error);
    }
  }

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
      logger.error("Failed to create print job:", error.message);
      throw new Error("Failed to create print job");
    }
  }

  /**
   * Get print job status
   */
  async getPrintJobStatus(luluPrintJobId) {
    try {
      logger.info(`Getting status for print job ${luluPrintJobId}`);

      const result = await this.makeRequest(
        "GET",
        `/print-jobs/${luluPrintJobId}/`
      );

      logger.info("Print job status retrieved", {
        printJobId: luluPrintJobId,
        status: result.status?.name,
      });

      return result;
    } catch (error) {
      logger.error(
        `Failed to get print job status for ${luluPrintJobId}:`,
        error.message
      );
      throw new Error("Failed to get print job status");
    }
  }

  /**
   * Cancel a print job (only if unpaid)
   */
  async cancelPrintJob(luluPrintJobId) {
    try {
      logger.info(`Canceling print job ${luluPrintJobId}`);

      const result = await this.makeRequest(
        "PATCH",
        `/print-jobs/${luluPrintJobId}/status/`,
        {
          status: "CANCELED",
        }
      );

      logger.info("Print job canceled successfully", {
        printJobId: luluPrintJobId,
      });

      return result;
    } catch (error) {
      logger.error(
        `Failed to cancel print job ${luluPrintJobId}:`,
        error.message
      );
      throw new Error("Failed to cancel print job");
    }
  }

  /**
   * Validate interior PDF file
   */
  async validateInteriorPDF(pdfUrl, podPackageId = null) {
    try {
      logger.info(`Validating interior PDF: ${pdfUrl}`);

      const requestData = {
        source_url: pdfUrl,
        ...(podPackageId && {
          pod_package_id: podPackageId || this.podPackageId,
        }),
      };

      const result = await this.makeRequest(
        "POST",
        "/validate-interior/",
        requestData
      );

      logger.info("Interior PDF validation initiated", {
        validationId: result.id,
        status: result.status,
      });

      return result;
    } catch (error) {
      logger.error("Failed to validate interior PDF:", error.message);
      throw new Error("Failed to validate interior PDF");
    }
  }

  /**
   * Get interior PDF validation result
   */
  async getInteriorValidationResult(validationId) {
    try {
      const result = await this.makeRequest(
        "GET",
        `/validate-interior/${validationId}/`
      );
      return result;
    } catch (error) {
      logger.error(
        `Failed to get interior validation result for ${validationId}:`,
        error.message
      );
      throw new Error("Failed to get interior validation result");
    }
  }

  /**
   * Validate cover PDF file
   */
  async validateCoverPDF(pdfUrl, pageCount, podPackageId = null) {
    try {
      logger.info(`Validating cover PDF: ${pdfUrl}`);

      const requestData = {
        source_url: pdfUrl,
        pod_package_id: podPackageId || this.podPackageId,
        interior_page_count: pageCount,
      };

      const result = await this.makeRequest(
        "POST",
        "/validate-cover/",
        requestData
      );

      logger.info("Cover PDF validation initiated", {
        validationId: result.id,
        status: result.status,
      });

      return result;
    } catch (error) {
      logger.error("Failed to validate cover PDF:", error.message);
      throw new Error("Failed to validate cover PDF");
    }
  }

  /**
   * Get cover PDF validation result
   */
  async getCoverValidationResult(validationId) {
    try {
      const result = await this.makeRequest(
        "GET",
        `/validate-cover/${validationId}/`
      );
      return result;
    } catch (error) {
      logger.error(
        `Failed to get cover validation result for ${validationId}:`,
        error.message
      );
      throw new Error("Failed to get cover validation result");
    }
  }

  /**
   * Calculate cover dimensions
   */
  async calculateCoverDimensions(pageCount, unit = "pt") {
    try {
      logger.info(`Calculating cover dimensions for ${pageCount} pages`);

      const requestData = {
        pod_package_id: this.podPackageId,
        interior_page_count: pageCount,
        unit: unit,
      };

      const result = await this.makeRequest(
        "POST",
        "/cover-dimensions/",
        requestData
      );

      logger.info("Cover dimensions calculated", {
        width: result.width,
        height: result.height,
        unit: result.unit,
      });

      return result;
    } catch (error) {
      logger.error("Failed to calculate cover dimensions:", error.message);
      throw new Error("Failed to calculate cover dimensions");
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

      // According to Lulu API docs, only 'url' and 'topics' are required for creation
      // 'is_active' is not part of the creation schema and is set to true by default
      const requestData = {
        url: webhookUrl,
        topics: topics,
      };

      const result = await this.makeRequest("POST", "/webhooks/", requestData);

      logger.info("Webhook created successfully", {
        webhookId: result.id,
        url: result.url,
        topics: result.topics,
        isActive: result.is_active,
      });

      return result;
    } catch (error) {
      logger.error("Failed to create webhook:", error.message);
      throw new Error("Failed to create webhook");
    }
  }

  /**
   * List all webhook subscriptions
   */
  async listWebhooks() {
    try {
      logger.debug("Fetching webhook subscriptions");

      const result = await this.makeRequest("GET", "/webhooks/");

      logger.debug("Webhooks retrieved successfully", {
        count: result.results?.length || 0,
      });

      return result;
    } catch (error) {
      logger.error("Failed to list webhooks:", error.message);
      throw new Error("Failed to list webhooks");
    }
  }

  /**
   * Get a specific webhook by ID
   */
  async getWebhook(webhookId) {
    try {
      logger.debug(`Fetching webhook ${webhookId}`);

      const result = await this.makeRequest("GET", `/webhooks/${webhookId}/`);

      logger.debug("Webhook retrieved successfully", {
        webhookId: result.id,
        url: result.url,
        isActive: result.is_active,
      });

      return result;
    } catch (error) {
      logger.error(`Failed to get webhook ${webhookId}:`, error.message);
      throw new Error("Failed to get webhook");
    }
  }

  /**
   * Update a webhook subscription
   */
  async updateWebhook(webhookId, updates) {
    try {
      logger.info(`Updating webhook ${webhookId}`, updates);

      const result = await this.makeRequest(
        "PATCH",
        `/webhooks/${webhookId}/`,
        updates
      );

      logger.info("Webhook updated successfully", {
        webhookId: result.id,
        url: result.url,
        topics: result.topics,
        isActive: result.is_active,
      });

      return result;
    } catch (error) {
      logger.error(`Failed to update webhook ${webhookId}:`, error.message);
      throw new Error("Failed to update webhook");
    }
  }

  /**
   * Delete a webhook subscription
   */
  async deleteWebhook(webhookId) {
    try {
      logger.info(`Deleting webhook ${webhookId}`);

      await this.makeRequest("DELETE", `/webhooks/${webhookId}/`);

      logger.info("Webhook deleted successfully", { webhookId });

      return { success: true, webhookId };
    } catch (error) {
      logger.error(`Failed to delete webhook ${webhookId}:`, error.message);
      throw new Error("Failed to delete webhook");
    }
  }

  /**
   * Test webhook submission
   */
  async testWebhook(webhookId, topic = "PRINT_JOB_STATUS_CHANGED") {
    try {
      logger.info(`Testing webhook ${webhookId} with topic ${topic}`);

      const result = await this.makeRequest(
        "POST",
        `/webhooks/${webhookId}/test-submission/${topic}/`
      );

      logger.info("Webhook test initiated successfully", {
        webhookId,
        topic,
        message: result,
      });

      return result;
    } catch (error) {
      logger.error(
        `Failed to test webhook ${webhookId} with topic ${topic}:`,
        error.message
      );
      throw new Error("Failed to test webhook");
    }
  }

  /**
   * Get webhook submissions (delivery history)
   */
  async getWebhookSubmissions(filters = {}) {
    try {
      logger.debug("Fetching webhook submissions", filters);

      // Build query parameters
      const queryParams = new URLSearchParams();
      if (filters.page) queryParams.append("page", filters.page);
      if (filters.pageSize) queryParams.append("page_size", filters.pageSize);
      if (filters.createdAfter)
        queryParams.append("created_after", filters.createdAfter);
      if (filters.createdBefore)
        queryParams.append("created_before", filters.createdBefore);
      if (filters.isSuccess !== undefined)
        queryParams.append("is_success", filters.isSuccess);
      if (filters.responseCode)
        queryParams.append("response_code", filters.responseCode);
      if (filters.webhookId)
        queryParams.append("webhook_id", filters.webhookId);

      const endpoint = `/webhook-submissions/${
        queryParams.toString() ? `?${queryParams.toString()}` : ""
      }`;

      const result = await this.makeRequest("GET", endpoint);

      logger.debug("Webhook submissions retrieved successfully", {
        count: result.results?.length || 0,
        total: result.count,
      });

      return result;
    } catch (error) {
      logger.error("Failed to get webhook submissions:", error.message);
      throw new Error("Failed to get webhook submissions");
    }
  }
}

module.exports = new LuluService();
