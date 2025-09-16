const { SESClient, SendEmailCommand } = require("@aws-sdk/client-ses");
const logger = require("../utils/logger");
const { getEmailTemplate } = require("../email-templates");
const {
  AWS_ACCESS_KEY_ID,
  AWS_SECRET_ACCESS_KEY,
  AWS_REGION,
  FROM_NAME,
  NO_REPLY_EMAIL_ADDRESS,
  WEB_URL,
  CONTACT_EMAIL_ADDRESS,
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
    Source: `"${FROM_NAME}" <${NO_REPLY_EMAIL_ADDRESS}>`,
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
  const myBooksUrl = `${WEB_URL}/my-books`;

  const template = getEmailTemplate(language, "welcome", {
    firstName,
    dashboardUrl: myBooksUrl, // Keep parameter name for backward compatibility
  });

  return sendEmail(
    email,
    template.subject,
    template.textBody,
    template.htmlBody
  );
};

/**
 * Send password change confirmation email
 * @param {string} email - User email
 * @param {string} firstName - User first name
 * @param {string} language - User's preferred language (default: 'en')
 */
const sendPasswordChangeConfirmation = async (
  email,
  firstName,
  language = "en"
) => {
  const template = getEmailTemplate(language, "passwordChangeConfirmation", {
    firstName,
  });

  return sendEmail(
    email,
    template.subject,
    template.textBody,
    template.htmlBody
  );
};

/**
 * Send email change verification email
 * @param {string} newEmail - New email address to verify
 * @param {string} firstName - User first name
 * @param {string} verificationToken - Email change verification token
 * @param {string} language - User's preferred language (default: 'en')
 */
const sendEmailChangeVerification = async (
  newEmail,
  firstName,
  verificationToken,
  language = "en"
) => {
  const verificationUrl = `${WEB_URL}/verify-email-change?token=${verificationToken}`;

  const template = getEmailTemplate(language, "emailChangeVerification", {
    firstName,
    newEmail,
    verificationUrl,
  });

  return sendEmail(
    newEmail,
    template.subject,
    template.textBody,
    template.htmlBody
  );
};

/**
 * Send book generation success email
 * @param {string} email - User email
 * @param {string} firstName - User first name
 * @param {string} bookTitle - Title of the generated book
 * @param {string} pdfUrl - URL to download the PDF
 * @param {string} language - User's preferred language (default: 'en')
 */
const sendBookGenerationSuccess = async (
  email,
  firstName,
  bookTitle,
  pdfUrl,
  language = "en"
) => {
  const myBooksUrl = `${WEB_URL}/my-books`;

  const template = getEmailTemplate(language, "bookGenerationSuccess", {
    firstName,
    bookTitle,
    pdfUrl,
    dashboardUrl: myBooksUrl, // Keep parameter name for backward compatibility
  });

  return sendEmail(
    email,
    template.subject,
    template.textBody,
    template.htmlBody
  );
};

/**
 * Send book generation failure email
 * @param {string} email - User email
 * @param {string} firstName - User first name
 * @param {string} bookTitle - Title of the book that failed to generate
 * @param {string} language - User's preferred language (default: 'en')
 */
const sendBookGenerationFailure = async (
  email,
  firstName,
  bookTitle,
  language = "en"
) => {
  const myBooksUrl = `${WEB_URL}/my-books`;
  const supportEmail = NO_REPLY_EMAIL_ADDRESS; // Use the same email for support contact

  const template = getEmailTemplate(language, "bookGenerationFailure", {
    firstName,
    bookTitle,
    dashboardUrl: myBooksUrl, // Keep parameter name for backward compatibility
    supportEmail,
  });

  return sendEmail(
    email,
    template.subject,
    template.textBody,
    template.htmlBody
  );
};

/**
 * Send contact form submission email
 * @param {string} name - Contact person's name
 * @param {string} email - Contact person's email
 * @param {string} subject - Contact subject
 * @param {string} message - Contact message
 * @param {string} language - User's preferred language (default: 'en')
 */
const sendContactForm = async (
  name,
  email,
  subject,
  message,
  language = "en"
) => {
  // Check if contact email is configured
  const contactAddress = CONTACT_EMAIL_ADDRESS || "arlo@pettales.ai";

  const template = getEmailTemplate(language, "contactForm", {
    name,
    email,
    subject,
    message,
  });

  // Send email to the configured contact email address
  // Set the reply-to as the user's email so responses go directly to them
  const params = {
    Source: `"${FROM_NAME}" <${NO_REPLY_EMAIL_ADDRESS}>`,
    Destination: {
      ToAddresses: [contactAddress],
    },
    ReplyToAddresses: [email], // This allows direct replies to the user
    Message: {
      Subject: {
        Data: template.subject,
        Charset: "UTF-8",
      },
      Body: {
        Text: {
          Data: template.textBody,
          Charset: "UTF-8",
        },
        Html: {
          Data: template.htmlBody,
          Charset: "UTF-8",
        },
      },
    },
  };

  try {
    const client = getSESClient();
    const command = new SendEmailCommand(params);
    const result = await client.send(command);
    logger.info("Contact form email sent successfully:", result.MessageId);
    return {
      success: true,
      messageId: result.MessageId,
    };
  } catch (error) {
    logger.error(`Error sending contact form email: ${error}`);
    throw new Error(`Failed to send contact form email: ${error.message}`);
  }
};

/**
 * Send print order shipped email
 */
const sendPrintOrderShippedEmail = async (user, printOrder, trackingInfo) => {
  try {
    const { WEB_URL } = require("../utils/constants");

    const templateParams = {
      firstName: user.first_name,
      bookTitle: printOrder.book_title,
      orderId: printOrder.external_id,
      trackingId: trackingInfo.tracking_id,
      trackingUrls: trackingInfo.tracking_urls || [],
      carrierName: trackingInfo.carrier_name,
      shippingAddress: formatShippingAddress(printOrder.shipping_address),
      myOrdersUrl: `${WEB_URL}/my-orders`,
    };

    const template = getTemplate("printOrderShipped", user.language || "en");
    const emailContent = template(templateParams);

    await sendEmail({
      to: user.email,
      subject: emailContent.subject,
      textBody: emailContent.textBody,
      htmlBody: emailContent.htmlBody,
    });

    logger.info("Print order shipped email sent successfully", {
      userId: user._id,
      orderId: printOrder.external_id,
      trackingId: trackingInfo.tracking_id,
    });
  } catch (error) {
    logger.error("Failed to send print order shipped email:", error);
    throw error;
  }
};

/**
 * Send print order rejected email
 */
const sendPrintOrderRejectedEmail = async (user, printOrder, errorMessage, creditsRefunded) => {
  try {
    const { WEB_URL, NO_REPLY_EMAIL_ADDRESS } = require("../utils/constants");

    const templateParams = {
      firstName: user.first_name,
      bookTitle: printOrder.book_title,
      orderId: printOrder.external_id,
      errorMessage: errorMessage,
      creditsRefunded: creditsRefunded,
      myOrdersUrl: `${WEB_URL}/my-orders`,
      supportEmail: NO_REPLY_EMAIL_ADDRESS,
    };

    const template = getTemplate("printOrderRejected", user.language || "en");
    const emailContent = template(templateParams);

    await sendEmail({
      to: user.email,
      subject: emailContent.subject,
      textBody: emailContent.textBody,
      htmlBody: emailContent.htmlBody,
    });

    logger.info("Print order rejected email sent successfully", {
      userId: user._id,
      orderId: printOrder.external_id,
      creditsRefunded,
    });
  } catch (error) {
    logger.error("Failed to send print order rejected email:", error);
    throw error;
  }
};

/**
 * Send print order canceled email
 */
const sendPrintOrderCanceledEmail = async (user, printOrder, reason, creditsRefunded) => {
  try {
    const { WEB_URL, NO_REPLY_EMAIL_ADDRESS } = require("../utils/constants");

    const templateParams = {
      firstName: user.first_name,
      bookTitle: printOrder.book_title,
      orderId: printOrder.external_id,
      reason: reason,
      creditsRefunded: creditsRefunded,
      myOrdersUrl: `${WEB_URL}/my-orders`,
      supportEmail: NO_REPLY_EMAIL_ADDRESS,
    };

    const template = getTemplate("printOrderCanceled", user.language || "en");
    const emailContent = template(templateParams);

    await sendEmail({
      to: user.email,
      subject: emailContent.subject,
      textBody: emailContent.textBody,
      htmlBody: emailContent.htmlBody,
    });

    logger.info("Print order canceled email sent successfully", {
      userId: user._id,
      orderId: printOrder.external_id,
      creditsRefunded,
    });
  } catch (error) {
    logger.error("Failed to send print order canceled email:", error);
    throw error;
  }
};

/**
 * Send print order in production email
 */
const sendPrintOrderInProductionEmail = async (user, printOrder) => {
  try {
    const { WEB_URL } = require("../utils/constants");

    const templateParams = {
      firstName: user.first_name,
      bookTitle: printOrder.book_title,
      orderId: printOrder.external_id,
      shippingAddress: formatShippingAddress(printOrder.shipping_address),
      myOrdersUrl: `${WEB_URL}/my-orders`,
    };

    const template = getTemplate("printOrderInProduction", user.language || "en");
    const emailContent = template(templateParams);

    await sendEmail({
      to: user.email,
      subject: emailContent.subject,
      textBody: emailContent.textBody,
      htmlBody: emailContent.htmlBody,
    });

    logger.info("Print order in production email sent successfully", {
      userId: user._id,
      orderId: printOrder.external_id,
    });
  } catch (error) {
    logger.error("Failed to send print order in production email:", error);
    throw error;
  }
};

/**
 * Send general print order status update email
 */
const sendPrintOrderStatusUpdateEmail = async (user, printOrder, status) => {
  try {
    const { WEB_URL } = require("../utils/constants");

    const templateParams = {
      firstName: user.first_name,
      bookTitle: printOrder.book_title,
      orderId: printOrder.external_id,
      status: status,
      statusMessage: null, // Will be generated by template
      myOrdersUrl: `${WEB_URL}/my-orders`,
    };

    const template = getTemplate("printOrderStatusUpdate", user.language || "en");
    const emailContent = template(templateParams);

    await sendEmail({
      to: user.email,
      subject: emailContent.subject,
      textBody: emailContent.textBody,
      htmlBody: emailContent.htmlBody,
    });

    logger.info("Print order status update email sent successfully", {
      userId: user._id,
      orderId: printOrder.external_id,
      status,
    });
  } catch (error) {
    logger.error("Failed to send print order status update email:", error);
    throw error;
  }
};

/**
 * Format shipping address for display
 */
const formatShippingAddress = (address) => {
  if (!address) return '';

  const parts = [
    address.name,
    address.street1,
    address.street2,
    `${address.city}, ${address.state_code} ${address.postcode}`,
    address.country_code
  ].filter(Boolean);

  return parts.join('\n');
};

module.exports = {
  sendEmail,
  sendEmailVerification,
  sendPasswordReset,
  sendWelcomeEmail,
  sendPasswordChangeConfirmation,
  sendEmailChangeVerification,
  sendBookGenerationSuccess,
  sendBookGenerationFailure,
  sendContactForm,
  sendPrintOrderShippedEmail,
  sendPrintOrderRejectedEmail,
  sendPrintOrderCanceledEmail,
  sendPrintOrderInProductionEmail,
  sendPrintOrderStatusUpdateEmail,
};
