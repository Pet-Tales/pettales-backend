const luluService = require("./luluService");
const logger = require("../utils/logger");
const webhookAlertService = require("./webhookAlertService");
const { LULU_WEBHOOK_URL, API_BASE_URL } = require("../utils/constants");

class WebhookLifecycleService {
  constructor() {
    this.webhookUrl =
      LULU_WEBHOOK_URL || `${API_BASE_URL}/api/webhooks/lulu/print-job-status`;
    this.topics = ["PRINT_JOB_STATUS_CHANGED"];
    this.registeredWebhookId = null;
    this.lastHealthCheck = null;
    this.healthCheckInterval = 30 * 60 * 1000; // 30 minutes
    this.maxRetries = 3;
    this.retryDelay = 5000; // 5 seconds
  }

  /**
   * Initialize webhook lifecycle - register webhook and start monitoring
   */
  async initialize() {
    try {
      logger.info("Initializing webhook lifecycle service");

      // Check if webhook is already registered
      await this.checkExistingWebhook();

      // Register webhook if not exists
      if (!this.registeredWebhookId) {
        await this.registerWebhook();
      }

      // Start health monitoring
      this.startHealthMonitoring();

      logger.info("Webhook lifecycle service initialized successfully", {
        webhookId: this.registeredWebhookId,
        webhookUrl: this.webhookUrl,
      });

      return {
        success: true,
        webhookId: this.registeredWebhookId,
        webhookUrl: this.webhookUrl,
      };
    } catch (error) {
      logger.error("Failed to initialize webhook lifecycle service:", error);
      throw error;
    }
  }

  /**
   * Check if webhook is already registered
   */
  async checkExistingWebhook() {
    try {
      logger.debug("Checking for existing webhook registration");

      const webhooks = await luluService.listWebhooks();

      if (webhooks.results && webhooks.results.length > 0) {
        // Find webhook with our URL
        const existingWebhook = webhooks.results.find(
          (webhook) => webhook.url === this.webhookUrl
        );

        if (existingWebhook) {
          this.registeredWebhookId = existingWebhook.id;
          logger.info("Found existing webhook registration", {
            webhookId: existingWebhook.id,
            url: existingWebhook.url,
            isActive: existingWebhook.is_active,
            topics: existingWebhook.topics,
          });

          // Reactivate if inactive
          if (!existingWebhook.is_active) {
            await this.reactivateWebhook(existingWebhook.id);
          }

          return existingWebhook;
        }
      }

      logger.debug("No existing webhook found for our URL");
      return null;
    } catch (error) {
      logger.error("Error checking existing webhook:", error);
      // Don't throw here, we'll try to register a new one
      return null;
    }
  }

  /**
   * Register new webhook with Lulu
   */
  async registerWebhook() {
    let lastError;

    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        logger.info(
          `Registering webhook (attempt ${attempt}/${this.maxRetries})`,
          {
            url: this.webhookUrl,
            topics: this.topics,
          }
        );

        const webhook = await luluService.createWebhook(
          this.webhookUrl,
          this.topics
        );

        this.registeredWebhookId = webhook.id;

        logger.info("Webhook registered successfully", {
          webhookId: webhook.id,
          url: webhook.url,
          topics: webhook.topics,
          isActive: webhook.is_active,
        });

        // Send registration alert
        await webhookAlertService.sendWebhookRegistrationAlert({
          webhookId: webhook.id,
          webhookUrl: webhook.url,
          topics: webhook.topics,
          isReregistration: attempt > 1,
        });

        return webhook;
      } catch (error) {
        lastError = error;
        logger.warn(
          `Webhook registration attempt ${attempt} failed:`,
          error.message
        );

        if (attempt < this.maxRetries) {
          logger.info(`Retrying webhook registration in ${this.retryDelay}ms`);
          await new Promise((resolve) => setTimeout(resolve, this.retryDelay));
        }
      }
    }

    logger.error("Failed to register webhook after all attempts:", lastError);
    throw new Error(`Failed to register webhook: ${lastError.message}`);
  }

  /**
   * Reactivate an inactive webhook
   */
  async reactivateWebhook(webhookId) {
    try {
      logger.info(`Reactivating webhook ${webhookId}`);

      const updatedWebhook = await luluService.updateWebhook(webhookId, {
        is_active: true,
      });

      logger.info("Webhook reactivated successfully", {
        webhookId: updatedWebhook.id,
        isActive: updatedWebhook.is_active,
      });

      return updatedWebhook;
    } catch (error) {
      logger.error(`Failed to reactivate webhook ${webhookId}:`, error);
      throw error;
    }
  }

  /**
   * Start health monitoring for webhook
   */
  startHealthMonitoring() {
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
    }

    this.healthCheckTimer = setInterval(async () => {
      try {
        await this.performHealthCheck();
      } catch (error) {
        logger.error("Webhook health check failed:", error);
      }
    }, this.healthCheckInterval);

    logger.info("Webhook health monitoring started", {
      interval: this.healthCheckInterval,
    });
  }

  /**
   * Stop health monitoring
   */
  stopHealthMonitoring() {
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
      this.healthCheckTimer = null;
      logger.info("Webhook health monitoring stopped");
    }
  }

  /**
   * Perform webhook health check
   */
  async performHealthCheck() {
    try {
      if (!this.registeredWebhookId) {
        logger.warn("No registered webhook ID for health check");
        return;
      }

      logger.debug(
        `Performing health check for webhook ${this.registeredWebhookId}`
      );

      // Get webhook status
      const webhook = await luluService.getWebhook(this.registeredWebhookId);

      // Check if webhook is active
      if (!webhook.is_active) {
        logger.warn("Webhook is inactive, attempting to reactivate", {
          webhookId: webhook.id,
        });

        await this.reactivateWebhook(webhook.id);
      }

      // Check recent submissions for failures
      await this.checkRecentSubmissions();

      this.lastHealthCheck = new Date();

      logger.debug("Webhook health check completed successfully", {
        webhookId: webhook.id,
        isActive: webhook.is_active,
        lastCheck: this.lastHealthCheck,
      });
    } catch (error) {
      logger.error("Webhook health check failed:", error);

      // If webhook not found, try to re-register
      if (
        error.message.includes("404") ||
        error.message.includes("Not found")
      ) {
        logger.warn("Webhook not found, attempting to re-register");
        this.registeredWebhookId = null;
        await this.registerWebhook();
      }
    }
  }

  /**
   * Check recent webhook submissions for failures
   * According to Lulu docs: After 5 different failed submissions in a row,
   * the webhook is deactivated (is_active field is set to false)
   */
  async checkRecentSubmissions() {
    try {
      const oneDayAgo = new Date(
        Date.now() - 24 * 60 * 60 * 1000
      ).toISOString();

      const submissions = await luluService.getWebhookSubmissions({
        webhookId: this.registeredWebhookId,
        createdAfter: oneDayAgo,
        pageSize: 50,
      });

      if (submissions.results && submissions.results.length > 0) {
        const failedSubmissions = submissions.results.filter(
          (submission) => !submission.is_success
        );

        // Check for consecutive failures that might trigger deactivation
        const recentSubmissions = submissions.results
          .sort((a, b) => new Date(b.date_created) - new Date(a.date_created))
          .slice(0, 10); // Check last 10 submissions

        let consecutiveFailures = 0;
        for (const submission of recentSubmissions) {
          if (!submission.is_success) {
            consecutiveFailures++;
          } else {
            break; // Stop counting if we hit a successful submission
          }
        }

        if (failedSubmissions.length > 0) {
          logger.warn("Found failed webhook submissions", {
            totalSubmissions: submissions.results.length,
            failedSubmissions: failedSubmissions.length,
            consecutiveFailures,
            failures: failedSubmissions.slice(0, 5).map((sub) => ({
              responseCode: sub.response_code,
              attempts: sub.attempts,
              topic: sub.topic,
              dateCreated: sub.date_created,
            })),
          });

          // Alert if we're approaching the 5 consecutive failure limit
          if (consecutiveFailures >= 3) {
            logger.warn(
              `Webhook has ${consecutiveFailures} consecutive failures. ` +
              `Webhook will be deactivated after 5 consecutive failures.`,
              {
                webhookId: this.registeredWebhookId,
                consecutiveFailures,
                recentFailures: recentSubmissions.slice(0, consecutiveFailures),
              }
            );
          }
        } else {
          logger.debug("All recent webhook submissions successful", {
            totalSubmissions: submissions.results.length,
          });
        }
      }
    } catch (error) {
      logger.error("Failed to check recent webhook submissions:", error);
    }
  }

  /**
   * Test webhook functionality
   * According to Lulu docs: Test endpoint sends dummy data of the selected topic to configured URL
   */
  async testWebhook(topic = "PRINT_JOB_STATUS_CHANGED") {
    try {
      if (!this.registeredWebhookId) {
        throw new Error("No webhook registered");
      }

      // Validate topic
      const validTopics = ["PRINT_JOB_STATUS_CHANGED"];
      if (!validTopics.includes(topic)) {
        throw new Error(`Invalid topic. Valid topics are: ${validTopics.join(", ")}`);
      }

      logger.info(`Testing webhook ${this.registeredWebhookId} with topic ${topic}`);

      const result = await luluService.testWebhook(this.registeredWebhookId, topic);

      logger.info("Webhook test completed", {
        webhookId: this.registeredWebhookId,
        topic,
        result,
      });

      return {
        success: true,
        webhookId: this.registeredWebhookId,
        topic,
        result,
      };
    } catch (error) {
      logger.error("Webhook test failed:", error);
      throw error;
    }
  }

  /**
   * Get webhook status and statistics
   */
  async getWebhookStatus() {
    try {
      if (!this.registeredWebhookId) {
        return {
          registered: false,
          webhookId: null,
          status: "not_registered",
        };
      }

      const webhook = await luluService.getWebhook(this.registeredWebhookId);

      // Get recent submissions
      const oneDayAgo = new Date(
        Date.now() - 24 * 60 * 60 * 1000
      ).toISOString();
      const submissions = await luluService.getWebhookSubmissions({
        webhookId: this.registeredWebhookId,
        createdAfter: oneDayAgo,
        pageSize: 100,
      });

      const stats = this.calculateSubmissionStats(submissions.results || []);

      return {
        registered: true,
        webhookId: webhook.id,
        url: webhook.url,
        topics: webhook.topics,
        isActive: webhook.is_active,
        lastHealthCheck: this.lastHealthCheck,
        stats,
      };
    } catch (error) {
      logger.error("Failed to get webhook status:", error);
      throw error;
    }
  }

  /**
   * Calculate submission statistics
   */
  calculateSubmissionStats(submissions) {
    const total = submissions.length;
    const successful = submissions.filter((sub) => sub.is_success).length;
    const failed = total - successful;
    const successRate = total > 0 ? (successful / total) * 100 : 0;

    const recentFailures = submissions
      .filter((sub) => !sub.is_success)
      .slice(0, 5)
      .map((sub) => ({
        responseCode: sub.response_code,
        attempts: sub.attempts,
        topic: sub.topic,
        dateCreated: sub.date_created,
      }));

    return {
      total,
      successful,
      failed,
      successRate: Math.round(successRate * 100) / 100,
      recentFailures,
    };
  }

  /**
   * Handle webhook failure recovery
   */
  async handleWebhookFailure(failureInfo) {
    try {
      logger.warn("Handling webhook failure", failureInfo);

      const { webhookId, failureCount, lastFailure } = failureInfo;

      // If failure count exceeds threshold, attempt recovery
      if (failureCount >= 3) {
        logger.warn(
          `Webhook ${webhookId} has ${failureCount} failures, attempting recovery`
        );

        // Try to reactivate the webhook
        try {
          await this.reactivateWebhook(webhookId);
          logger.info(
            `Successfully reactivated webhook ${webhookId} after failures`
          );

          // Send recovery alert
          await webhookAlertService.sendWebhookRecoveryAlert({
            webhookId,
            recoveryMethod: "reactivation",
            previousFailures: failureCount,
          });
        } catch (reactivationError) {
          logger.error(
            `Failed to reactivate webhook ${webhookId}:`,
            reactivationError
          );

          // If reactivation fails, try to re-register
          logger.info("Attempting to re-register webhook");
          this.registeredWebhookId = null;
          await this.registerWebhook();

          // Send recovery alert for re-registration
          await webhookAlertService.sendWebhookRecoveryAlert({
            webhookId: this.registeredWebhookId,
            recoveryMethod: "re-registration",
            previousFailures: failureCount,
          });
        }
      }
    } catch (error) {
      logger.error("Error handling webhook failure:", error);
    }
  }

  /**
   * Monitor webhook health continuously
   */
  async monitorWebhookHealth() {
    try {
      if (!this.registeredWebhookId) {
        logger.debug("No webhook registered for health monitoring");
        return;
      }

      // Get recent submissions to check for patterns of failure
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
      const submissions = await luluService.getWebhookSubmissions({
        webhookId: this.registeredWebhookId,
        createdAfter: oneHourAgo,
        pageSize: 20,
      });

      if (submissions.results && submissions.results.length > 0) {
        const recentFailures = submissions.results.filter(
          (sub) => !sub.is_success
        );

        if (recentFailures.length >= 3) {
          logger.warn(
            `Detected ${recentFailures.length} webhook failures in the last hour`
          );

          // Get analytics for alert
          const analytics = await this.getWebhookAnalytics("1h");

          // Send failure alert
          await webhookAlertService.sendWebhookFailureAlert({
            webhookId: this.registeredWebhookId,
            failureCount: recentFailures.length,
            failureRate: analytics.summary
              ? 100 - analytics.summary.successRate
              : 100,
            lastFailure: recentFailures[0],
            analytics,
          });

          await this.handleWebhookFailure({
            webhookId: this.registeredWebhookId,
            failureCount: recentFailures.length,
            lastFailure: recentFailures[0],
          });
        }
      }
    } catch (error) {
      logger.error("Error monitoring webhook health:", error);
    }
  }

  /**
   * Get detailed webhook analytics
   */
  async getWebhookAnalytics(timeRange = "24h") {
    try {
      if (!this.registeredWebhookId) {
        return {
          error: "No webhook registered",
        };
      }

      const timeRanges = {
        "1h": 1 * 60 * 60 * 1000,
        "24h": 24 * 60 * 60 * 1000,
        "7d": 7 * 24 * 60 * 60 * 1000,
        "30d": 30 * 24 * 60 * 60 * 1000,
      };

      const timeMs = timeRanges[timeRange] || timeRanges["24h"];
      const startTime = new Date(Date.now() - timeMs).toISOString();

      const submissions = await luluService.getWebhookSubmissions({
        webhookId: this.registeredWebhookId,
        createdAfter: startTime,
        pageSize: 1000, // Get more data for analytics
      });

      const analytics = this.calculateDetailedAnalytics(
        submissions.results || []
      );

      return {
        timeRange,
        startTime,
        webhookId: this.registeredWebhookId,
        ...analytics,
      };
    } catch (error) {
      logger.error("Error getting webhook analytics:", error);
      throw error;
    }
  }

  /**
   * Calculate detailed analytics from submissions
   */
  calculateDetailedAnalytics(submissions) {
    const total = submissions.length;
    const successful = submissions.filter((sub) => sub.is_success).length;
    const failed = total - successful;
    const successRate = total > 0 ? (successful / total) * 100 : 0;

    // Group by response code
    const responseCodeStats = {};
    submissions.forEach((sub) => {
      const code = sub.response_code || "unknown";
      responseCodeStats[code] = (responseCodeStats[code] || 0) + 1;
    });

    // Group by topic
    const topicStats = {};
    submissions.forEach((sub) => {
      const topic = sub.topic || "unknown";
      topicStats[topic] = (topicStats[topic] || 0) + 1;
    });

    // Calculate average attempts
    const totalAttempts = submissions.reduce(
      (sum, sub) => sum + (sub.attempts || 1),
      0
    );
    const avgAttempts = total > 0 ? totalAttempts / total : 0;

    // Find failure patterns
    const failurePatterns = this.analyzeFailurePatterns(
      submissions.filter((sub) => !sub.is_success)
    );

    // Calculate uptime percentage (based on successful deliveries)
    const uptimePercentage = successRate;

    return {
      summary: {
        total,
        successful,
        failed,
        successRate: Math.round(successRate * 100) / 100,
        avgAttempts: Math.round(avgAttempts * 100) / 100,
        uptimePercentage: Math.round(uptimePercentage * 100) / 100,
      },
      responseCodeStats,
      topicStats,
      failurePatterns,
      recentFailures: submissions
        .filter((sub) => !sub.is_success)
        .slice(0, 10)
        .map((sub) => ({
          responseCode: sub.response_code,
          attempts: sub.attempts,
          topic: sub.topic,
          dateCreated: sub.date_created,
        })),
    };
  }

  /**
   * Analyze failure patterns to identify issues
   */
  analyzeFailurePatterns(failures) {
    const patterns = {
      timeoutErrors: 0,
      connectionErrors: 0,
      serverErrors: 0,
      clientErrors: 0,
      unknownErrors: 0,
    };

    failures.forEach((failure) => {
      const code = failure.response_code;

      if (!code || code === 0) {
        patterns.connectionErrors++;
      } else if (code >= 500) {
        patterns.serverErrors++;
      } else if (code >= 400) {
        patterns.clientErrors++;
      } else {
        patterns.unknownErrors++;
      }
    });

    return patterns;
  }

  /**
   * Cleanup webhook lifecycle service
   */
  async cleanup() {
    try {
      logger.info("Cleaning up webhook lifecycle service");

      this.stopHealthMonitoring();

      // Optionally delete webhook on cleanup (uncomment if needed)
      // if (this.registeredWebhookId) {
      //   await luluService.deleteWebhook(this.registeredWebhookId);
      // }

      logger.info("Webhook lifecycle service cleanup completed");
    } catch (error) {
      logger.error("Error during webhook lifecycle cleanup:", error);
    }
  }
}

module.exports = new WebhookLifecycleService();
