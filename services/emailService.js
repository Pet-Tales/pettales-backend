const { SESClient, SendEmailCommand } = require("@aws-sdk/client-ses");
const logger = require("../utils/logger");
const {
  AWS_ACCESS_KEY_ID,
  AWS_SECRET_ACCESS_KEY,
  AWS_REGION,
  FROM_EMAIL,
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
    Source: FROM_EMAIL,
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
 */
const sendEmailVerification = async (email, firstName, verificationToken) => {
  const verificationUrl = `${WEB_URL}/verify-email?token=${verificationToken}`;

  const subject = "Verify your PetTalesAI account";

  const textBody = `
Hello ${firstName},

Welcome to PetTalesAI! Please verify your email address to complete your account setup.

Click the link below to verify your email:
${verificationUrl}

This link will expire in 24 hours.

If you didn't create an account with PetTalesAI, please ignore this email.

Best regards,
The PetTalesAI Team
  `.trim();

  return sendEmail(email, subject, textBody);
};

/**
 * Send password reset email
 * @param {string} email - User email
 * @param {string} firstName - User first name
 * @param {string} resetToken - Password reset token
 */
const sendPasswordReset = async (email, firstName, resetToken) => {
  const resetUrl = `${WEB_URL}/reset-password?token=${resetToken}`;

  const subject = "Reset your PetTalesAI password";

  const textBody = `
Hello ${firstName},

You requested to reset your password for your PetTalesAI account.

Click the link below to reset your password:
${resetUrl}

This link will expire in 1 hour.

If you didn't request a password reset, please ignore this email.

Best regards,
The PetTalesAI Team
  `.trim();

  return sendEmail(email, subject, textBody);
};

/**
 * Send welcome email
 * @param {string} email - User email
 * @param {string} firstName - User first name
 */
const sendWelcomeEmail = async (email, firstName) => {
  const subject = "Welcome to PetTalesAI!";

  const textBody = `
Hello ${firstName},

Welcome to PetTalesAI! We're excited to have you join our community of storytellers.

With PetTalesAI, you can create magical, personalized children's books featuring your beloved pets as the main characters. Our AI-powered platform makes it easy to bring your pet's adventures to life.

Here's what you can do next:
- Create your first character
- Generate your first story
- Explore our gallery for inspiration

If you have any questions, feel free to reach out to our support team.

Happy storytelling!
The PetTalesAI Team
  `.trim();

  return sendEmail(email, subject, textBody);
};

module.exports = {
  sendEmail,
  sendEmailVerification,
  sendPasswordReset,
  sendWelcomeEmail,
};
