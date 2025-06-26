const { SESClient, SendEmailCommand } = require("@aws-sdk/client-ses");
const logger = require("../utils/logger");
const { getEmailTemplate } = require("../email-templates");
const {
  AWS_ACCESS_KEY_ID,
  AWS_SECRET_ACCESS_KEY,
  AWS_REGION,
  NO_REPLY_EMAIL_ADDRESS,
  WEB_URL,
} = require("../utils/constants");

// Lazy-load SES client to ensure environment variables are loaded
let sesClient = null;

const getSESClient = () => {
  if (!sesClient) {
    // Validate AWS credentials
    if (!AWS_ACCESS_KEY_ID || !AWS_SECRET_ACCESS_KEY || !AWS_REGION) {
      throw new Error("AWS credentials not properly configured");
    }

    // Configure AWS SES Client
    sesClient = new SESClient({
      region: AWS_REGION,
      credentials: {
        accessKeyId: AWS_ACCESS_KEY_ID,
        secretAccessKey: AWS_SECRET_ACCESS_KEY,
      },
    });
  }
  return sesClient;
};

/**
 * Send email using AWS SES
 * @param {string} to - Recipient email address
 * @param {string} subject - Email subject
 * @param {string} textBody - Plain text body
 * @param {string} htmlBody - HTML body (optional)
 */
const sendEmail = async (to, subject, textBody, htmlBody = null) => {
  // Check if AWS credentials are configured
  if (!AWS_ACCESS_KEY_ID || !AWS_SECRET_ACCESS_KEY || !AWS_REGION) {
    logger.warn("AWS credentials not configured. Skipping email send.", {
      to,
      subject,
    });
    return {
      success: false,
      message: "Email service not configured",
    };
  }

  const params = {
    Source: NO_REPLY_EMAIL_ADDRESS,
    Destination: {
      ToAddresses: [to],
    },
    Message: {
      Subject: {
        Data: subject,
        Charset: "UTF-8",
      },
      Body: {
        Text: {
          Data: textBody,
          Charset: "UTF-8",
        },
      },
    },
  };

  // Add HTML body if provided
  if (htmlBody) {
    params.Message.Body.Html = {
      Data: htmlBody,
      Charset: "UTF-8",
    };
  }

  try {
    const client = getSESClient();
    const command = new SendEmailCommand(params);
    const result = await client.send(command);
    logger.info("Email sent successfully:", result.MessageId);
    return {
      success: true,
      messageId: result.MessageId,
    };
  } catch (error) {
    logger.error(`Error sending email: ${error}`);
    throw new Error(`Failed to send email: ${error.message}`);
  }
};

/**
 * Send email verification email
 * @param {string} email - User email
 * @param {string} firstName - User first name
 * @param {string} verificationToken - Verification token
 * @param {string} language - User's preferred language (default: 'en')
 */
const sendEmailVerification = async (
  email,
  firstName,
  verificationToken,
  language = "en"
) => {
  const verificationUrl = `${WEB_URL}/verify-email?token=${verificationToken}`;

  const template = getEmailTemplate(language, "emailVerification", {
    firstName,
    verificationUrl,
  });

  return sendEmail(
    email,
    template.subject,
    template.textBody,
    template.htmlBody
  );
};

/**
 * Send password reset email
 * @param {string} email - User email
 * @param {string} firstName - User first name
 * @param {string} resetToken - Password reset token
 * @param {string} language - User's preferred language (default: 'en')
 */
const sendPasswordReset = async (
  email,
  firstName,
  resetToken,
  language = "en"
) => {
  const resetUrl = `${WEB_URL}/reset-password?token=${resetToken}`;

  const template = getEmailTemplate(language, "passwordReset", {
    firstName,
    resetUrl,
  });

  return sendEmail(
    email,
    template.subject,
    template.textBody,
    template.htmlBody
  );
};

/**
 * Send welcome email
 * @param {string} email - User email
 * @param {string} firstName - User first name
 * @param {string} language - User's preferred language (default: 'en')
 */
const sendWelcomeEmail = async (email, firstName, language = "en") => {
  const dashboardUrl = `${WEB_URL}/dashboard`;

  const template = getEmailTemplate(language, "welcome", {
    firstName,
    dashboardUrl,
  });

  return sendEmail(
    email,
    template.subject,
    template.textBody,
    template.htmlBody
  );
};

module.exports = {
  sendEmail,
  sendEmailVerification,
  sendPasswordReset,
  sendWelcomeEmail,
};
