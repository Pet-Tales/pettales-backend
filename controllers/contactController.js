const { sendContactForm } = require("../services/emailService");
const logger = require("../utils/logger");

/**
 * Submit contact form
 * @route POST /api/contact
 * @access Public
 */
const submitContactForm = async (req, res) => {
  try {
    const { name, email, subject, message, language = "en" } = req.body;

    // Validate required fields
    if (!name || !email || !subject || !message) {
      return res.status(400).json({
        success: false,
        message: "All fields are required",
        errors: {
          name: !name ? "Name is required" : null,
          email: !email ? "Email is required" : null,
          subject: !subject ? "Subject is required" : null,
          message: !message ? "Message is required" : null,
        },
      });
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        message: "Invalid email address",
        errors: {
          email: "Please provide a valid email address",
        },
      });
    }

    // Validate field lengths
    if (name.length > 100) {
      return res.status(400).json({
        success: false,
        message: "Name is too long",
        errors: {
          name: "Name must be less than 100 characters",
        },
      });
    }

    if (subject.length > 200) {
      return res.status(400).json({
        success: false,
        message: "Subject is too long",
        errors: {
          subject: "Subject must be less than 200 characters",
        },
      });
    }

    if (message.length > 2000) {
      return res.status(400).json({
        success: false,
        message: "Message is too long",
        errors: {
          message: "Message must be less than 2000 characters",
        },
      });
    }

    // Sanitize input (basic HTML escape)
    const sanitizedData = {
      name: name.trim().replace(/[<>]/g, ""),
      email: email.trim().toLowerCase(),
      subject: subject.trim().replace(/[<>]/g, ""),
      message: message.trim().replace(/[<>]/g, ""),
    };

    // Log the contact form submission (without sensitive data)
    logger.info("Contact form submission received", {
      name: sanitizedData.name,
      email: sanitizedData.email,
      subject: sanitizedData.subject,
      messageLength: sanitizedData.message.length,
      language,
      ip: req.ip,
      userAgent: req.get("User-Agent"),
    });

    // Send the contact form email
    const emailResult = await sendContactForm(
      sanitizedData.name,
      sanitizedData.email,
      sanitizedData.subject,
      sanitizedData.message,
      language
    );

    if (!emailResult.success) {
      logger.error("Failed to send contact form email", {
        error: emailResult.message,
        name: sanitizedData.name,
        email: sanitizedData.email,
      });

      return res.status(500).json({
        success: false,
        message: "Failed to send your message. Please try again later.",
      });
    }

    logger.info("Contact form email sent successfully", {
      messageId: emailResult.messageId,
      name: sanitizedData.name,
      email: sanitizedData.email,
    });

    res.status(200).json({
      success: true,
      message: "Your message has been sent successfully. We'll get back to you soon!",
    });
  } catch (error) {
    logger.error("Error in submitContactForm:", error);
    res.status(500).json({
      success: false,
      message: "An unexpected error occurred. Please try again later.",
    });
  }
};

module.exports = {
  submitContactForm,
};
