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
    const maxRetries = 
