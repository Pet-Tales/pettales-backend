const crypto = require("crypto");
const printOrderService = require("../services/printOrderService");
const emailService = require("../services/emailService");
const logger = require("../utils/logger");
const { LULU_WEBHOOK_SECRET } = require("../utils/constants");

/**
 * Verify Lulu webhook signature
 * According to Lulu docs: HMAC is calculated with API secret as a key (UTF-8 encoded),
 * payload as a message (UTF-8 encoded) and SHA-256 as hash function.
 * HMAC is sent in Lulu-HMAC-SHA256 header.
 */
const verifyWebhookSignature = (payload, signature) => {
  if (!LULU_WEBHOOK_SECRET) {
    logger.warn(
      "LULU_WEBHOOK_SECRET not configured, skipping signature verification"
    );
    return true; // Allow in development/testing
  }

  if (!signature) {
    logger.warn("No Lulu-HMAC-SHA256 signature provided");
    return false;
  }

  try {
    // Calculate expected signature using raw payload data
    // Important: Use raw response data to avoid JSON formatting issues
    const expectedSignature = crypto
      .createHmac("sha256", LULU_WEBHOOK_SECRET)
      .update(payload, "utf8")
      .digest("hex");

    // Lulu sends signature as "Lulu-HMAC-SHA256: <signature>"
    const receivedSignature = signature.replace("Lulu-HMAC-SHA256: ", "");

    // Use timing-safe comparison to prevent timing attacks
    return crypto.timingSafeEqual(
      Buffer.from(expectedSignature, "hex"),
      Buffer.from(receivedSignature, "hex")
    );
  } catch (error) {
    logger.error("Error verifying webhook signature:", error);
    return false;
  }
};

/**
 * Handle Lulu print job status change webhook
 * POST /api/webhooks/lulu/print-job-status
 *
 * According to Lulu docs:
 * - Each submission payload contains 2 fields: topic and data
 * - Data depends on the topic
 * - PRINT_JOB_STATUS_CHANGED webhook is sent every time owned print job status is updated
 * - The data sent in the payload is print job data, same as returned by print job details endpoint
 */
const handlePrintJobStatusChange = async (req, res) => {
  try {
    const signature = req.headers["lulu-hmac-sha256"];

    // Important: Use raw payload for signature verification to avoid JSON formatting issues
    // We need to capture the raw body before JSON parsing
    const payload = req.rawBody || JSON.stringify(req.body);

    logger.info("Received Lulu webhook", {
      topic: req.body.topic,
      printJobId: req.body.data?.id,
      status: req.body.data?.status?.name,
      hasSignature: !!signature,
    });

    // Verify webhook signature using raw payload
    if (!verifyWebhookSignature(payload, signature)) {
      logger.error("Invalid webhook signature", {
        receivedSignature: signature,
        payloadLength: payload.length,
      });
      return res.status(401).json({
        success: false,
        message: "Invalid signature",
      });
    }

    const { topic, data } = req.body;

    // Validate required fields according to Lulu webhook spec
    if (!topic || !data) {
      logger.error("Invalid webhook payload: missing topic or data", {
        hasTopic: !!topic,
        hasData: !!data,
      });
      return res.status(400).json({
        success: false,
        message: "Invalid payload: missing topic or data",
      });
    }

    // Handle different webhook topics
    switch (topic) {
      case "PRINT_JOB_STATUS_CHANGED":
        await handlePrintJobStatusChanged(data);
        break;
      default:
        logger.warn(`Unknown webhook topic: ${topic}`);
        return res.status(400).json({
          success: false,
          message: `Unknown topic: ${topic}`,
        });
    }

    // Return 200 status to acknowledge successful processing
    // This prevents Lulu from retrying the webhook
    res.status(200).json({
      success: true,
      message: "Webhook processed successfully",
    });
  } catch (error) {
    logger.error("Error processing Lulu webhook:", error);

    // Return 500 status to trigger Lulu's retry mechanism
    // According to docs, failed submissions are retried 5 times
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

/**
 * Handle print job status change
 */
const handlePrintJobStatusChanged = async (printJobData) => {
  try {
    const { id: luluPrintJobId, status, line_item_statuses } = printJobData;

    logger.info("Processing print job status change", {
      luluPrintJobId,
      newStatus: status?.name,
      message: status?.message,
    });

    // Update print order in database
    const updatedOrder = await printOrderService.updatePrintOrderFromWebhook(
      printJobData
    );

    if (!updatedOrder) {
      logger.warn(`No print order found for Lulu job ID: ${luluPrintJobId}`);
      return;
    }

    // Handle status-specific actions
    const statusName = status?.name?.toLowerCase();

    switch (statusName) {
      case "shipped":
        await handleOrderShipped(updatedOrder, line_item_statuses);
        break;
      case "rejected":
        await handleOrderRejected(updatedOrder, status?.message);
        break;
      case "canceled":
        await handleOrderCanceled(updatedOrder, status?.message);
        break;
      case "in_production":
        await handleOrderInProduction(updatedOrder);
        break;
      default:
        // Send general status update email
        await sendOrderStatusEmail(updatedOrder, statusName);
        break;
    }

    logger.info("Print job status change processed successfully", {
      printOrderId: updatedOrder._id,
      luluPrintJobId,
      newStatus: statusName,
    });
  } catch (error) {
    logger.error("Error handling print job status change:", error);
    throw error;
  }
};

/**
 * Handle order shipped
 */
const handleOrderShipped = async (printOrder, lineItemStatuses) => {
  try {
    logger.info(`Order ${printOrder.external_id} has been shipped`);

    // Extract tracking information
    let trackingInfo = null;
    if (lineItemStatuses && lineItemStatuses.length > 0) {
      const firstItem = lineItemStatuses[0];
      if (firstItem.messages) {
        trackingInfo = {
          tracking_id: firstItem.messages.tracking_id,
          tracking_urls: firstItem.messages.tracking_urls || [],
          carrier_name: firstItem.messages.carrier_name,
        };
      }
    }

    // Send shipped notification email
    await sendOrderShippedEmail(printOrder, trackingInfo);

    logger.info("Order shipped notification sent", {
      printOrderId: printOrder._id,
      trackingId: trackingInfo?.tracking_id,
    });
  } catch (error) {
    logger.error("Error handling shipped order:", error);
  }
};

/**
 * Handle order rejected
 */
const handleOrderRejected = async (printOrder, errorMessage) => {
  try {
    logger.info(
      `Order ${printOrder.external_id} was rejected: ${errorMessage}`
    );

    // Refund credits to user with specific reason
    await printOrderService.refundPrintOrder(
      printOrder._id,
      null,
      `Order rejected: ${errorMessage || "Unknown reason"}`
    );

    // Send rejection notification email
    await sendOrderRejectedEmail(printOrder, errorMessage);

    logger.info("Order rejection handled", {
      printOrderId: printOrder._id,
      creditsRefunded: printOrder.total_cost_credits,
      reason: errorMessage,
    });
  } catch (error) {
    logger.error("Error handling rejected order:", error);
  }
};

/**
 * Handle order canceled
 */
const handleOrderCanceled = async (printOrder, reason) => {
  try {
    logger.info(`Order ${printOrder.external_id} was canceled: ${reason}`);

    // Refund credits to user if not already refunded
    if (printOrder.status !== "canceled") {
      await printOrderService.refundPrintOrder(
        printOrder._id,
        null,
        `Order canceled: ${reason || "Unknown reason"}`
      );
    }

    // Send cancellation notification email
    await sendOrderCanceledEmail(printOrder, reason);

    logger.info("Order cancellation handled", {
      printOrderId: printOrder._id,
      reason,
    });
  } catch (error) {
    logger.error("Error handling canceled order:", error);
  }
};

/**
 * Handle order in production
 */
const handleOrderInProduction = async (printOrder) => {
  try {
    logger.info(`Order ${printOrder.external_id} is now in production`);

    // Send production notification email
    await sendOrderInProductionEmail(printOrder);

    logger.info("Order in production notification sent", {
      printOrderId: printOrder._id,
    });
  } catch (error) {
    logger.error("Error handling order in production:", error);
  }
};

/**
 * Send order status email
 */
const sendOrderStatusEmail = async (printOrder, status) => {
  try {
    logger.info("Sending order status email", {
      printOrderId: printOrder._id,
      status,
      userEmail: printOrder.shipping_address?.email,
    });

    // Get user information for email
    const User = require("../models/User");
    const user = await User.findById(printOrder.user_id);

    if (user) {
      const emailService = require("../services/emailService");
      await emailService.sendPrintOrderStatusUpdateEmail(user, printOrder, status);

      logger.info("Order status email sent successfully", {
        userId: user._id,
        orderId: printOrder.external_id,
        status,
      });
    } else {
      logger.warn("Could not send status email - user not found", {
        userId: printOrder.user_id,
        orderId: printOrder.external_id,
      });
    }
  } catch (error) {
    logger.error("Error sending order status email:", error);
    // Don't throw - email failure shouldn't fail the webhook processing
  }
};

/**
 * Send order shipped email
 */
const sendOrderShippedEmail = async (printOrder, trackingInfo) => {
  try {
    logger.info("Sending order shipped email", {
      printOrderId: printOrder._id,
      trackingId: trackingInfo?.tracking_id,
    });

    // Get user information for email
    const User = require("../models/User");
    const user = await User.findById(printOrder.user_id);

    if (user && trackingInfo) {
      const emailService = require("../services/emailService");
      await emailService.sendPrintOrderShippedEmail(user, printOrder, trackingInfo);

      logger.info("Order shipped email sent successfully", {
        userId: user._id,
        orderId: printOrder.external_id,
        trackingId: trackingInfo.tracking_id,
      });
    } else {
      logger.warn("Could not send shipped email - missing user or tracking info", {
        hasUser: !!user,
        hasTrackingInfo: !!trackingInfo,
        orderId: printOrder.external_id,
      });
    }
  } catch (error) {
    logger.error("Error sending order shipped email:", error);
    // Don't throw - email failure shouldn't fail the webhook processing
  }
};

/**
 * Send order rejected email
 */
const sendOrderRejectedEmail = async (printOrder, errorMessage) => {
  try {
    logger.info("Sending order rejected email", {
      printOrderId: printOrder._id,
      errorMessage,
    });

    // Get user information for email
    const User = require("../models/User");
    const user = await User.findById(printOrder.user_id);

    if (user) {
      const emailService = require("../services/emailService");
      await emailService.sendPrintOrderRejectedEmail(
        user,
        printOrder,
        errorMessage,
        printOrder.total_cost_credits
      );

      logger.info("Order rejected email sent successfully", {
        userId: user._id,
        orderId: printOrder.external_id,
        creditsRefunded: printOrder.total_cost_credits,
      });
    } else {
      logger.warn("Could not send rejected email - user not found", {
        userId: printOrder.user_id,
        orderId: printOrder.external_id,
      });
    }
  } catch (error) {
    logger.error("Error sending order rejected email:", error);
    // Don't throw - email failure shouldn't fail the webhook processing
  }
};

/**
 * Send order canceled email
 */
const sendOrderCanceledEmail = async (printOrder, reason) => {
  try {
    logger.info("Sending order canceled email", {
      printOrderId: printOrder._id,
      reason,
    });

    // Get user information for email
    const User = require("../models/User");
    const user = await User.findById(printOrder.user_id);

    if (user) {
      const emailService = require("../services/emailService");
      await emailService.sendPrintOrderCanceledEmail(
        user,
        printOrder,
        reason,
        printOrder.total_cost_credits
      );

      logger.info("Order canceled email sent successfully", {
        userId: user._id,
        orderId: printOrder.external_id,
        creditsRefunded: printOrder.total_cost_credits,
      });
    } else {
      logger.warn("Could not send canceled email - user not found", {
        userId: printOrder.user_id,
        orderId: printOrder.external_id,
      });
    }
  } catch (error) {
    logger.error("Error sending order canceled email:", error);
    // Don't throw - email failure shouldn't fail the webhook processing
  }
};

/**
 * Send order in production email
 */
const sendOrderInProductionEmail = async (printOrder) => {
  try {
    logger.info("Sending order in production email", {
      printOrderId: printOrder._id,
    });

    // Get user information for email
    const User = require("../models/User");
    const user = await User.findById(printOrder.user_id);

    if (user) {
      const emailService = require("../services/emailService");
      await emailService.sendPrintOrderInProductionEmail(user, printOrder);

      logger.info("Order in production email sent successfully", {
        userId: user._id,
        orderId: printOrder.external_id,
      });
    } else {
      logger.warn("Could not send in production email - user not found", {
        userId: printOrder.user_id,
        orderId: printOrder.external_id,
      });
    }
  } catch (error) {
    logger.error("Error sending order in production email:", error);
    // Don't throw - email failure shouldn't fail the webhook processing
  }
};

module.exports = {
  handlePrintJobStatusChange,
};
