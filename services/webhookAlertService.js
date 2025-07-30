const logger = require("../utils/logger");
const emailService = require("./emailService");
const { CONTACT_EMAIL_ADDRESS } = require("../utils/constants");

class WebhookAlertService {
  constructor() {
    this.alertThresholds = {
      failureRate: 50, // Alert if failure rate exceeds 50%
      consecutiveFailures: 5, // Alert after 5 consecutive failures
      downtime: 30 * 60 * 1000, // Alert after 30 minutes of downtime
    };
    
    this.alertCooldown = 60 * 60 * 1000; // 1 hour cooldown between similar alerts
    this.lastAlerts = new Map(); // Track last alert times
  }

  /**
   * Check if alert should be sent (respects cooldown)
   */
  shouldSendAlert(alertType, webhookId) {
    const alertKey = `${alertType}_${webhookId}`;
    const lastAlert = this.lastAlerts.get(alertKey);
    
    if (!lastAlert) {
      return true;
    }
    
    const timeSinceLastAlert = Date.now() - lastAlert;
    return timeSinceLastAlert > this.alertCooldown;
  }

  /**
   * Record that an alert was sent
   */
  recordAlert(alertType, webhookId) {
    const alertKey = `${alertType}_${webhookId}`;
    this.lastAlerts.set(alertKey, Date.now());
  }

  /**
   * Send webhook failure alert
   */
  async sendWebhookFailureAlert(alertData) {
    try {
      const { webhookId, failureCount, failureRate, lastFailure, analytics } = alertData;

      if (!this.shouldSendAlert("failure", webhookId)) {
        logger.debug(`Skipping webhook failure alert due to cooldown: ${webhookId}`);
        return;
      }

      const alertLevel = this.determineAlertLevel(failureCount, failureRate);
      
      logger.warn("Sending webhook failure alert", {
        webhookId,
        failureCount,
        failureRate,
        alertLevel,
      });

      // Log detailed alert information
      logger.error("WEBHOOK ALERT: High failure rate detected", {
        webhookId,
        failureCount,
        failureRate: `${failureRate}%`,
        alertLevel,
        lastFailure: {
          responseCode: lastFailure?.response_code,
          attempts: lastFailure?.attempts,
          dateCreated: lastFailure?.date_created,
        },
        analytics: {
          total: analytics?.summary?.total,
          successful: analytics?.summary?.successful,
          failed: analytics?.summary?.failed,
          uptimePercentage: analytics?.summary?.uptimePercentage,
        },
      });

      // Send email alert if email service is configured
      if (CONTACT_EMAIL_ADDRESS) {
        await this.sendEmailAlert({
          type: "webhook_failure",
          level: alertLevel,
          webhookId,
          failureCount,
          failureRate,
          lastFailure,
          analytics,
        });
      }

      this.recordAlert("failure", webhookId);
    } catch (error) {
      logger.error("Failed to send webhook failure alert:", error);
    }
  }

  /**
   * Send webhook recovery alert
   */
  async sendWebhookRecoveryAlert(alertData) {
    try {
      const { webhookId, recoveryMethod, previousFailures } = alertData;

      logger.info("Sending webhook recovery alert", {
        webhookId,
        recoveryMethod,
        previousFailures,
      });

      // Log recovery information
      logger.info("WEBHOOK RECOVERY: Webhook restored", {
        webhookId,
        recoveryMethod,
        previousFailures,
        timestamp: new Date().toISOString(),
      });

      // Send email alert if email service is configured
      if (CONTACT_EMAIL_ADDRESS) {
        await this.sendEmailAlert({
          type: "webhook_recovery",
          level: "info",
          webhookId,
          recoveryMethod,
          previousFailures,
        });
      }
    } catch (error) {
      logger.error("Failed to send webhook recovery alert:", error);
    }
  }

  /**
   * Send webhook registration alert
   */
  async sendWebhookRegistrationAlert(alertData) {
    try {
      const { webhookId, webhookUrl, topics, isReregistration } = alertData;

      logger.info("Sending webhook registration alert", {
        webhookId,
        webhookUrl,
        topics,
        isReregistration,
      });

      // Log registration information
      logger.info("WEBHOOK REGISTRATION: Webhook registered", {
        webhookId,
        webhookUrl,
        topics,
        isReregistration,
        timestamp: new Date().toISOString(),
      });

      // Send email alert if email service is configured
      if (CONTACT_EMAIL_ADDRESS && isReregistration) {
        await this.sendEmailAlert({
          type: "webhook_registration",
          level: "info",
          webhookId,
          webhookUrl,
          topics,
          isReregistration,
        });
      }
    } catch (error) {
      logger.error("Failed to send webhook registration alert:", error);
    }
  }

  /**
   * Determine alert level based on failure metrics
   */
  determineAlertLevel(failureCount, failureRate) {
    if (failureRate >= 90 || failureCount >= 10) {
      return "critical";
    } else if (failureRate >= 70 || failureCount >= 7) {
      return "high";
    } else if (failureRate >= 50 || failureCount >= 5) {
      return "medium";
    } else {
      return "low";
    }
  }

  /**
   * Send email alert
   */
  async sendEmailAlert(alertData) {
    try {
      const { type, level, webhookId } = alertData;
      
      const subject = this.generateEmailSubject(type, level, webhookId);
      const body = this.generateEmailBody(alertData);

      // Note: This assumes emailService has a sendAlert method
      // You may need to adapt this based on your email service implementation
      if (emailService.sendAlert) {
        await emailService.sendAlert({
          to: CONTACT_EMAIL_ADDRESS,
          subject,
          body,
          priority: level === "critical" ? "high" : "normal",
        });
      } else {
        logger.warn("Email service does not support alerts, logging instead");
      }
    } catch (error) {
      logger.error("Failed to send email alert:", error);
    }
  }

  /**
   * Generate email subject for alerts
   */
  generateEmailSubject(type, level, webhookId) {
    const levelText = level.toUpperCase();
    const typeText = type.replace("_", " ").toUpperCase();
    
    return `[${levelText}] PetTalesAI Webhook Alert: ${typeText} - ${webhookId}`;
  }

  /**
   * Generate email body for alerts
   */
  generateEmailBody(alertData) {
    const { type, level, webhookId, timestamp = new Date().toISOString() } = alertData;

    let body = `
Webhook Alert - PetTalesAI System

Alert Type: ${type.replace("_", " ").toUpperCase()}
Alert Level: ${level.toUpperCase()}
Webhook ID: ${webhookId}
Timestamp: ${timestamp}

`;

    switch (type) {
      case "webhook_failure":
        body += `
Failure Details:
- Failure Count: ${alertData.failureCount}
- Failure Rate: ${alertData.failureRate}%
- Last Failure Response Code: ${alertData.lastFailure?.response_code || "Unknown"}
- Last Failure Attempts: ${alertData.lastFailure?.attempts || "Unknown"}

Analytics Summary:
- Total Submissions: ${alertData.analytics?.summary?.total || 0}
- Successful: ${alertData.analytics?.summary?.successful || 0}
- Failed: ${alertData.analytics?.summary?.failed || 0}
- Uptime Percentage: ${alertData.analytics?.summary?.uptimePercentage || 0}%

Action Required: Please check the webhook configuration and endpoint health.
`;
        break;

      case "webhook_recovery":
        body += `
Recovery Details:
- Recovery Method: ${alertData.recoveryMethod}
- Previous Failures: ${alertData.previousFailures}

The webhook has been successfully restored and is now operational.
`;
        break;

      case "webhook_registration":
        body += `
Registration Details:
- Webhook URL: ${alertData.webhookUrl}
- Topics: ${alertData.topics?.join(", ") || "Unknown"}
- Is Re-registration: ${alertData.isReregistration ? "Yes" : "No"}

The webhook has been ${alertData.isReregistration ? "re-" : ""}registered successfully.
`;
        break;
    }

    body += `
---
PetTalesAI Webhook Monitoring System
`;

    return body;
  }

  /**
   * Check webhook health and send alerts if needed
   */
  async checkAndAlert(webhookStatus, analytics) {
    try {
      const { webhookId, isActive } = webhookStatus;
      const { summary, recentFailures } = analytics;

      // Check if webhook is inactive
      if (!isActive) {
        await this.sendWebhookFailureAlert({
          webhookId,
          failureCount: summary.failed,
          failureRate: 100 - summary.successRate,
          lastFailure: recentFailures[0],
          analytics,
        });
        return;
      }

      // Check failure rate threshold
      if (summary.successRate < (100 - this.alertThresholds.failureRate)) {
        await this.sendWebhookFailureAlert({
          webhookId,
          failureCount: summary.failed,
          failureRate: 100 - summary.successRate,
          lastFailure: recentFailures[0],
          analytics,
        });
      }

      // Check consecutive failures
      if (summary.failed >= this.alertThresholds.consecutiveFailures) {
        await this.sendWebhookFailureAlert({
          webhookId,
          failureCount: summary.failed,
          failureRate: 100 - summary.successRate,
          lastFailure: recentFailures[0],
          analytics,
        });
      }
    } catch (error) {
      logger.error("Error checking webhook health for alerts:", error);
    }
  }
}

module.exports = new WebhookAlertService();
