const webhookLifecycleService = require("../services/webhookLifecycleService");
const luluService = require("../services/luluService");
const logger = require("../utils/logger");

/**
 * Get webhook status and statistics
 * GET /api/admin/webhooks/status
 */
const getWebhookStatus = async (req, res) => {
  try {
    logger.info("Getting webhook status");

    const status = await webhookLifecycleService.getWebhookStatus();

    res.status(200).json({
      success: true,
      data: status,
    });
  } catch (error) {
    logger.error("Failed to get webhook status:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to get webhook status",
    });
  }
};

/**
 * Register or re-register webhook
 * POST /api/admin/webhooks/register
 */
const registerWebhook = async (req, res) => {
  try {
    logger.info("Manual webhook registration requested");

    const result = await webhookLifecycleService.initialize();

    res.status(200).json({
      success: true,
      message: "Webhook registered successfully",
      data: result,
    });
  } catch (error) {
    logger.error("Failed to register webhook:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to register webhook",
    });
  }
};

/**
 * Test webhook functionality
 * POST /api/admin/webhooks/test
 */
const testWebhook = async (req, res) => {
  try {
    logger.info("Webhook test requested");

    const result = await webhookLifecycleService.testWebhook();

    res.status(200).json({
      success: true,
      message: "Webhook test initiated successfully",
      data: result,
    });
  } catch (error) {
    logger.error("Failed to test webhook:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to test webhook",
    });
  }
};

/**
 * Get webhook submissions (delivery history)
 * GET /api/admin/webhooks/submissions
 */
const getWebhookSubmissions = async (req, res) => {
  try {
    const {
      page = 1,
      pageSize = 20,
      createdAfter,
      createdBefore,
      isSuccess,
      responseCode,
    } = req.query;

    logger.info("Getting webhook submissions", {
      page,
      pageSize,
      filters: { createdAfter, createdBefore, isSuccess, responseCode },
    });

    const filters = {
      page: parseInt(page),
      pageSize: parseInt(pageSize),
    };

    if (createdAfter) filters.createdAfter = createdAfter;
    if (createdBefore) filters.createdBefore = createdBefore;
    if (isSuccess !== undefined) filters.isSuccess = isSuccess === "true";
    if (responseCode) filters.responseCode = responseCode;

    const submissions = await luluService.getWebhookSubmissions(filters);

    res.status(200).json({
      success: true,
      data: submissions,
    });
  } catch (error) {
    logger.error("Failed to get webhook submissions:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to get webhook submissions",
    });
  }
};

/**
 * List all webhooks
 * GET /api/admin/webhooks
 */
const listWebhooks = async (req, res) => {
  try {
    logger.info("Listing all webhooks");

    const webhooks = await luluService.listWebhooks();

    res.status(200).json({
      success: true,
      data: webhooks,
    });
  } catch (error) {
    logger.error("Failed to list webhooks:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to list webhooks",
    });
  }
};

/**
 * Update webhook configuration
 * PATCH /api/admin/webhooks/:webhookId
 */
const updateWebhook = async (req, res) => {
  try {
    const { webhookId } = req.params;
    const updates = req.body;

    logger.info(`Updating webhook ${webhookId}`, updates);

    // Validate updates
    const allowedUpdates = ["url", "topics", "is_active"];
    const updateKeys = Object.keys(updates);
    const isValidUpdate = updateKeys.every((key) =>
      allowedUpdates.includes(key)
    );

    if (!isValidUpdate) {
      return res.status(400).json({
        success: false,
        message: "Invalid update fields. Allowed: url, topics, is_active",
      });
    }

    const updatedWebhook = await luluService.updateWebhook(webhookId, updates);

    res.status(200).json({
      success: true,
      message: "Webhook updated successfully",
      data: updatedWebhook,
    });
  } catch (error) {
    logger.error(`Failed to update webhook ${req.params.webhookId}:`, error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to update webhook",
    });
  }
};

/**
 * Delete webhook
 * DELETE /api/admin/webhooks/:webhookId
 */
const deleteWebhook = async (req, res) => {
  try {
    const { webhookId } = req.params;

    logger.info(`Deleting webhook ${webhookId}`);

    await luluService.deleteWebhook(webhookId);

    res.status(200).json({
      success: true,
      message: "Webhook deleted successfully",
    });
  } catch (error) {
    logger.error(`Failed to delete webhook ${req.params.webhookId}:`, error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to delete webhook",
    });
  }
};

/**
 * Force health check
 * POST /api/admin/webhooks/health-check
 */
const forceHealthCheck = async (req, res) => {
  try {
    logger.info("Manual health check requested");

    await webhookLifecycleService.performHealthCheck();

    res.status(200).json({
      success: true,
      message: "Health check completed successfully",
    });
  } catch (error) {
    logger.error("Failed to perform health check:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to perform health check",
    });
  }
};

/**
 * Get webhook configuration info
 * GET /api/admin/webhooks/config
 */
const getWebhookConfig = async (req, res) => {
  try {
    const config = {
      webhookUrl: webhookLifecycleService.webhookUrl,
      topics: webhookLifecycleService.topics,
      healthCheckInterval: webhookLifecycleService.healthCheckInterval,
      lastHealthCheck: webhookLifecycleService.lastHealthCheck,
      registeredWebhookId: webhookLifecycleService.registeredWebhookId,
    };

    res.status(200).json({
      success: true,
      data: config,
    });
  } catch (error) {
    logger.error("Failed to get webhook config:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to get webhook config",
    });
  }
};

/**
 * Reactivate webhook
 * POST /api/admin/webhooks/:webhookId/reactivate
 */
const reactivateWebhook = async (req, res) => {
  try {
    const { webhookId } = req.params;

    logger.info(`Reactivating webhook ${webhookId}`);

    const reactivatedWebhook = await webhookLifecycleService.reactivateWebhook(
      webhookId
    );

    res.status(200).json({
      success: true,
      message: "Webhook reactivated successfully",
      data: reactivatedWebhook,
    });
  } catch (error) {
    logger.error(
      `Failed to reactivate webhook ${req.params.webhookId}:`,
      error
    );
    res.status(500).json({
      success: false,
      message: error.message || "Failed to reactivate webhook",
    });
  }
};

/**
 * Get webhook analytics
 * GET /api/admin/webhooks/analytics
 */
const getWebhookAnalytics = async (req, res) => {
  try {
    const { timeRange = "24h" } = req.query;

    logger.info(`Getting webhook analytics for time range: ${timeRange}`);

    const analytics = await webhookLifecycleService.getWebhookAnalytics(
      timeRange
    );

    res.status(200).json({
      success: true,
      data: analytics,
    });
  } catch (error) {
    logger.error("Failed to get webhook analytics:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to get webhook analytics",
    });
  }
};

/**
 * Monitor webhook health
 * POST /api/admin/webhooks/monitor
 */
const monitorWebhookHealth = async (req, res) => {
  try {
    logger.info("Manual webhook health monitoring requested");

    await webhookLifecycleService.monitorWebhookHealth();

    res.status(200).json({
      success: true,
      message: "Webhook health monitoring completed successfully",
    });
  } catch (error) {
    logger.error("Failed to monitor webhook health:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to monitor webhook health",
    });
  }
};

module.exports = {
  getWebhookStatus,
  registerWebhook,
  testWebhook,
  getWebhookSubmissions,
  listWebhooks,
  updateWebhook,
  deleteWebhook,
  forceHealthCheck,
  getWebhookConfig,
  reactivateWebhook,
  getWebhookAnalytics,
  monitorWebhookHealth,
};
