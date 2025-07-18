const { User, Session } = require("../models");
const { emailService } = require("../services");
const { tokenUtils } = require("../utils");
const { validationResult } = require("express-validator");
const logger = require("../utils/logger");
const {
  DEFAULT_CREDITS_BALANCE,
  COOKIE_OPTIONS,
  COOKIE_CLEAR_OPTIONS,
  IS_LOCAL_DEV,
  WEB_URL,
} = require("../utils/constants");
const {
  sendErrorResponse,
  sendValidationErrorResponse,
  sendDatabaseErrorResponse,
} = require("../utils/errorCodes");

/**
 * Register a new user with email and password
 */
const register = async (req, res) => {
  try {
    // Check validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return sendValidationErrorResponse(res, errors);
    }

    const { email, password, preferred_language } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      // If user exists but email is not verified, return specific error code
      if (!existingUser.email_verified) {
        return sendErrorResponse(res, "REG_005");
      }
      // If user exists and is verified, return generic error
      return sendErrorResponse(res, "REG_001");
    }

    // Generate email verification token
    const emailVerificationToken = tokenUtils.generateEmailVerificationToken();
    const emailVerificationExpiry =
      tokenUtils.generateEmailVerificationExpiry();

    // Create new user
    const user = new User({
      email,
      password_hash: password, // Will be hashed by pre-save middleware
      first_name: "", // Empty by default, will be populated from Google OAuth if available
      last_name: "", // Empty by default, will be populated from Google OAuth if available
      email_verification_token: emailVerificationToken,
      email_verification_expires: emailVerificationExpiry,
      credits_balance: DEFAULT_CREDITS_BALANCE,
      preferred_language: preferred_language || "en", // Use provided language or default to "en"
    });

    await user.save();
    logger.auth("register", email, true, { userId: user._id });

    // Send verification email
    try {
      await emailService.sendEmailVerification(
        email,
        "User", // Use "User" as default name for email
        emailVerificationToken,
        user.preferred_language || "en"
      );
      logger.email("verification_sent", email, true);
    } catch (emailError) {
      logger.email("verification_sent", email, false, {
        error: emailError.message,
      });
      // Don't fail registration if email fails
    }

    res.status(201).json({
      success: true,
      message:
        "User registered successfully. Please check your email for verification.",
      data: {
        user: {
          id: user._id,
          email: user.email,
          firstName: user.first_name || "",
          lastName: user.last_name || "",
          emailVerified: user.email_verified,
        },
      },
    });
  } catch (error) {
    logger.error(`Registration error: ${error}`);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

/**
 * Login user with email and password
 */
const login = async (req, res) => {
  try {
    // Check validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: errors.array(),
      });
    }

    const { email, password } = req.body;

    // Find user by email
    const user = await User.findOne({ email, status: "active" });

    if (!user) {
      logger.info("Login attempt - No user found for email:", email);
      return sendErrorResponse(res, "AUTH_002");
    }

    // Check password
    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      logger.info("Login attempt - Invalid password for user:", email);
      return sendErrorResponse(res, "AUTH_001");
    }

    // Check if email is verified
    if (!user.email_verified) {
      logger.info("Login attempt - Email not verified for user:", email);
      return sendErrorResponse(res, "AUTH_003");
    }

    logger.info("Login attempt - All checks passed for user:", email);

    // Create session
    const sessionToken = tokenUtils.generateSessionToken();
    const sessionExpiry = tokenUtils.generateSessionExpiry();

    const session = new Session({
      user_id: user._id,
      session_token: sessionToken,
      expires_at: sessionExpiry,
      user_agent: req.get("User-Agent"),
      ip_address: req.ip,
    });

    await session.save();

    // Set session cookie
    const cookieOptions = {
      ...COOKIE_OPTIONS,
      expires: sessionExpiry,
    };

    logger.info("Setting session cookie with options:", {
      ...cookieOptions,
      sessionToken: sessionToken.substring(0, 10) + "...",
      userEmail: user.email,
    });
    res.cookie("session_token", sessionToken, cookieOptions);

    res.json({
      success: true,
      message: "Login successful",
      data: {
        user: {
          id: user._id,
          email: user.email,
          firstName: user.first_name,
          lastName: user.last_name,
          profileImageUrl: user.profile_image_url,
          emailVerified: user.email_verified,
          creditsBalance: user.credits_balance,
          preferredLanguage: user.preferred_language,
          hasPassword: !!user.password_hash, // Indicate if user has a password
        },
      },
    });
  } catch (error) {
    logger.error(`Login error: ${error}`);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

/**
 * Logout user
 */
const logout = async (req, res) => {
  try {
    const sessionToken = req.cookies.session_token;

    if (sessionToken) {
      // Delete session from database
      await Session.deleteOne({ session_token: sessionToken });
    }

    // Clear session cookie with same options as when it was set
    res.clearCookie("session_token", COOKIE_CLEAR_OPTIONS);

    res.json({
      success: true,
      message: "Logout successful",
    });
  } catch (error) {
    logger.error(`Logout error: ${error}`);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

/**
 * Verify email address
 */
const verifyEmail = async (req, res) => {
  try {
    const { token } = req.query;

    if (!token) {
      return res.status(400).json({
        success: false,
        message: "Verification token is required",
      });
    }

    // First check if user with this token exists (regardless of expiry)
    let user = await User.findOne({
      email_verification_token: token,
      status: "active",
    });

    // If no user found with this token, check if it's already been used
    if (!user) {
      // Check if there's a user who had this token but is now verified
      const verifiedUser = await User.findOne({
        email_verification_token: null,
        email_verified: true,
        status: "active",
      });

      if (verifiedUser) {
        return res.status(400).json({
          success: false,
          message: "This verification link has already been used",
        });
      }

      return res.status(400).json({
        success: false,
        message: "Invalid verification token",
      });
    }

    // Check if user is already verified
    if (user.email_verified) {
      return res.status(400).json({
        success: false,
        message: "Email is already verified",
      });
    }

    // Check if token is expired
    if (
      user.email_verification_expires &&
      user.email_verification_expires < new Date()
    ) {
      return res.status(400).json({
        success: false,
        message: "Verification token has expired",
      });
    }

    // Update user as verified
    user.email_verified = true;
    user.email_verification_token = null;
    user.email_verification_expires = null;
    await user.save();

    // Create session to automatically log in the user
    const sessionToken = tokenUtils.generateSessionToken();
    const sessionExpiry = tokenUtils.generateSessionExpiry();

    const session = new Session({
      user_id: user._id,
      session_token: sessionToken,
      expires_at: sessionExpiry,
      user_agent: req.get("User-Agent"),
      ip_address: req.ip,
    });

    await session.save();

    // Set session cookie
    const cookieOptions = {
      ...COOKIE_OPTIONS,
      expires: sessionExpiry,
    };

    logger.info("Setting session cookie with options:", cookieOptions);
    res.cookie("session_token", sessionToken, cookieOptions);

    // Send welcome email
    try {
      await emailService.sendWelcomeEmail(
        user.email,
        user.first_name || "User",
        user.preferred_language || "en"
      );
    } catch (emailError) {
      logger.error(`Failed to send welcome email: ${emailError}`);
      // Don't fail verification if welcome email fails
    }

    res.json({
      success: true,
      message: "Email verified successfully",
      data: {
        user: {
          id: user._id,
          email: user.email,
          firstName: user.first_name || "",
          lastName: user.last_name || "",
          profileImageUrl: user.profile_image_url,
          emailVerified: user.email_verified,
          creditsBalance: user.credits_balance,
          preferredLanguage: user.preferred_language,
        },
      },
    });
  } catch (error) {
    logger.error(`Email verification error: ${error}`);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

/**
 * Resend email verification
 */
const resendEmailVerification = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: "Email is required",
      });
    }

    // Find user
    const user = await User.findOne({ email, status: "active" });
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    if (user.email_verified) {
      return res.status(400).json({
        success: false,
        message: "Email is already verified",
      });
    }

    // Generate new verification token
    const emailVerificationToken = tokenUtils.generateEmailVerificationToken();
    const emailVerificationExpiry =
      tokenUtils.generateEmailVerificationExpiry();

    user.email_verification_token = emailVerificationToken;
    user.email_verification_expires = emailVerificationExpiry;
    await user.save();

    // Send verification email
    await emailService.sendEmailVerification(
      email,
      user.first_name,
      emailVerificationToken,
      user.preferred_language || "en"
    );

    res.json({
      success: true,
      message: "Verification email sent successfully",
    });
  } catch (error) {
    logger.error(`Resend verification error: ${error}`);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

/**
 * Get current user information
 */
const getCurrentUser = async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Not authenticated",
      });
    }

    res.json({
      success: true,
      data: {
        user: {
          id: req.user._id,
          email: req.user.email,
          firstName: req.user.first_name,
          lastName: req.user.last_name,
          profileImageUrl: req.user.profile_image_url,
          emailVerified: req.user.email_verified,
          creditsBalance: req.user.credits_balance,
          preferredLanguage: req.user.preferred_language,
          hasPassword: !!req.user.password_hash, // Indicate if user has a password
        },
      },
    });
  } catch (error) {
    logger.error(`Get current user error: ${error}`);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

/**
 * Handle Google OAuth callback
 */
const googleCallback = async (req, res) => {
  try {
    const user = req.user; // Set by passport

    // Create session
    const sessionToken = tokenUtils.generateSessionToken();
    const sessionExpiry = tokenUtils.generateSessionExpiry();

    const session = new Session({
      user_id: user._id,
      session_token: sessionToken,
      expires_at: sessionExpiry,
      user_agent: req.get("User-Agent"),
      ip_address: req.ip,
    });

    await session.save();

    // Set session cookie
    const cookieOptions = {
      ...COOKIE_OPTIONS,
      expires: sessionExpiry,
    };

    logger.info("Setting session cookie with options:", cookieOptions);
    res.cookie("session_token", sessionToken, cookieOptions);

    // Check for stored redirect parameter from cookie
    const redirectPath = req.cookies.oauth_redirect;

    // Clear the redirect cookie with same options as when it was set
    if (redirectPath) {
      const { DEBUG_MODE } = require("../utils/constants");
      res.clearCookie("oauth_redirect", {
        httpOnly: true,
        secure: !DEBUG_MODE,
        sameSite: "lax",
        ...(IS_LOCAL_DEV ? { domain: "127.0.0.1" } : {}),
      });
    }

    // Redirect to frontend
    if (redirectPath) {
      res.redirect(`${WEB_URL}${redirectPath}`);
    } else {
      res.redirect(`${WEB_URL}/dashboard`);
    }
  } catch (error) {
    logger.error(`Google callback error: ${error}`);
    res.redirect(`${WEB_URL}/login?error=auth_failed`);
  }
};

/**
 * Request password reset
 */
const requestPasswordReset = async (req, res) => {
  try {
    // Check validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: errors.array(),
      });
    }

    const { email } = req.body;

    // Find user by email
    const user = await User.findOne({ email, status: "active" });

    // Always return success to prevent email enumeration
    // But only send email if user exists
    if (user) {
      // Check rate limiting - max 3 requests per hour
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
      const recentResetRequests = await User.countDocuments({
        email,
        password_reset_expires: { $gt: oneHourAgo },
      });

      if (recentResetRequests >= 3) {
        logger.warn(`Password reset rate limit exceeded for email: ${email}`);
        return sendErrorResponse(res, "AUTH_011");
      }

      // Generate password reset token
      const resetToken = tokenUtils.generatePasswordResetToken();
      const resetExpiry = tokenUtils.generatePasswordResetExpiry();

      // Update user with reset token
      user.password_reset_token = resetToken;
      user.password_reset_expires = resetExpiry;
      await user.save();

      logger.info(`Password reset requested for user: ${email}`);

      // Send password reset email
      try {
        await emailService.sendPasswordReset(
          email,
          user.first_name || "User",
          resetToken,
          user.preferred_language || "en"
        );
        logger.email("password_reset_sent", email, true);
      } catch (emailError) {
        logger.email("password_reset_sent", email, false, {
          error: emailError.message,
        });
        // Don't fail the request if email fails
      }
    } else {
      logger.info(`Password reset requested for non-existent email: ${email}`);
    }

    res.json({
      success: true,
      message:
        "If an account with that email exists, a password reset link has been sent.",
    });
  } catch (error) {
    logger.error(`Request password reset error: ${error}`);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

/**
 * Reset password using token
 */
const resetPassword = async (req, res) => {
  try {
    // Check validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: errors.array(),
      });
    }

    const { token, password } = req.body;

    // Find user with valid reset token
    const user = await User.findOne({
      password_reset_token: token,
      password_reset_expires: { $gt: new Date() },
      status: "active",
    });

    if (!user) {
      logger.warn(`Invalid or expired password reset token: ${token}`);
      return sendErrorResponse(res, "AUTH_010");
    }

    // Update password and clear reset token
    user.password_hash = password; // Will be hashed by pre-save middleware
    user.password_reset_token = null;
    user.password_reset_expires = null;
    await user.save();

    logger.info(`Password reset successful for user: ${user.email}`);

    // Invalidate all existing sessions for this user
    await Session.deleteMany({ user_id: user._id });
    logger.info(`All sessions invalidated for user: ${user.email}`);

    // Send confirmation email
    try {
      await emailService.sendPasswordChangeConfirmation(
        user.email,
        user.first_name || "User",
        user.preferred_language || "en"
      );
    } catch (emailError) {
      logger.error(
        `Failed to send password change confirmation: ${emailError}`
      );
      // Don't fail the request if email fails
    }

    res.json({
      success: true,
      message:
        "Password has been reset successfully. Please log in with your new password.",
    });
  } catch (error) {
    logger.error(`Reset password error: ${error}`);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

module.exports = {
  register,
  login,
  logout,
  verifyEmail,
  resendEmailVerification,
  getCurrentUser,
  googleCallback,
  requestPasswordReset,
  resetPassword,
};
