const express = require("express");
const router = express.Router();
const webhookManagementController = require("../controllers/webhookManagementController");
const { authenticateUser, requireAuth } = require("../middleware/auth");
const rateLimit = require("express-rate-limit");

// Rate limiting for webhook management endpoints
const webhookManagementRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 50, // Limit each IP to 50 requests per windowMs
  message: {
    success: false,
    message:
      "Too many webhook management requests from this IP, please try again later.",
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Apply authentication requirement to all routes
router.use(requireAuth);
router.use(webhookManagementRateLimit);

/**
 * @route GET /api/admin/webhooks/status
 * @desc Get webhook status and statistics
 * @access Admin
 */
router.get("/status", webhookManagementController.getWebhookStatus);

/**
 * @route GET /api/admin/webhooks/config
 * @desc Get webhook configuration info
 * @access Admin
 */
router.get("/config", webhookManagementController.getWebhookConfig);

/**
 * @route POST /api/admin/webhooks/register
 * @desc Register or re-register webhook
 * @access Admin
 */
router.post("/register", webhookManagementController.registerWebhook);

/**
 * @route POST /api/admin/webhooks/test
 * @desc Test webhook functionality
 * @access Admin
 */
router.post("/test", webhookManagementController.testWebhook);

/**
 * @route POST /api/admin/webhooks/health-check
 * @desc Force health check
 * @access Admin
 */
router.post("/health-check", webhookManagementController.forceHealthCheck);

/**
 * @route GET /api/admin/webhooks/analytics
 * @desc Get webhook analytics
 * @access Admin
 */
router.get("/analytics", webhookManagementController.getWebhookAnalytics);

/**
 * @route POST /api/admin/webhooks/monitor
 * @desc Monitor webhook health
 * @access Admin
 */
router.post("/monitor", webhookManagementController.monitorWebhookHealth);

/**
 * @route GET /api/admin/webhooks/submissions
 * @desc Get webhook submissions (delivery history)
 * @access Admin
 */
router.get("/submissions", webhookManagementController.getWebhookSubmissions);

/**
 * @route GET /api/admin/webhooks
 * @desc List all webhooks
 * @access Admin
 */
router.get("/", webhookManagementController.listWebhooks);

/**
 * @route PATCH /api/admin/webhooks/:webhookId
 * @desc Update webhook configuration
 * @access Admin
 */
router.patch("/:webhookId", webhookManagementController.updateWebhook);

/**
 * @route DELETE /api/admin/webhooks/:webhookId
 * @desc Delete webhook
 * @access Admin
 */
router.delete("/:webhookId", webhookManagementController.deleteWebhook);

/**
 * @route POST /api/admin/webhooks/:webhookId/reactivate
 * @desc Reactivate webhook
 * @access Admin
 */
router.post(
  "/:webhookId/reactivate",
  webhookManagementController.reactivateWebhook
);

module.exports = router;
