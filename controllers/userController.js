const { validationResult } = require("express-validator");
const { User, Session } = require("../models");
const logger = require("../utils/logger");
const emailService = require("../services/emailService");
const s3Service = require("../services/s3Service");
const tokenUtils = require("../utils/tokenUtils");

/**
 * Update user's language preference
 */
const updateLanguagePreference = async (req, res) => {
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

    // Check if user is authenticated
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    const { language } = req.body;

    // Update user's preferred language
    const updatedUser = await User.findByIdAndUpdate(
      req.user._id,
      { preferred_language: language },
      { new: true, runValidators: true }
    );

    if (!updatedUser) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    logger.info(
      `User ${req.user.email} updated language preference to ${language}`
    );

    res.json({
      success: true,
      message: "Language preference updated successfully",
      data: {
        user: {
          id: updatedUser._id,
          email: updatedUser.email,
          firstName: updatedUser.first_name,
          lastName: updatedUser.last_name,
          profileImageUrl: updatedUser.profile_image_url,
          emailVerified: updatedUser.email_verified,
          creditsBalance: updatedUser.credits_balance,
          preferredLanguage: updatedUser.preferred_language,
        },
      },
    });
  } catch (error) {
    logger.error(`Update language preference error: ${error}`);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

/**
 * Get user profile information
 */
const getProfile = async (req, res) => {
  try {
    // Check if user is authenticated
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
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
          createdAt: req.user.created_at,
          hasPassword: !!req.user.password_hash, // Indicate if user has a password
          role: req.user.role,
        },
      },
    });
  } catch (error) {
    logger.error(`Get profile error: ${error}`);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

/**
 * Update user profile information
 */
const updateProfile = async (req, res) => {
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

    // Check if user is authenticated
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    const { firstName, lastName, email } = req.body;
    const user = req.user;

    // Prepare update object for immediate changes
    const updateData = {};
    if (firstName !== undefined) updateData.first_name = firstName;
    if (lastName !== undefined) updateData.last_name = lastName;

    // Handle email change separately (requires verification)
    let emailChangeMessage = null;
    if (email && email !== user.email) {
      // Check if the new email is already in use
      const existingUser = await User.findOne({
        email: email.toLowerCase(),
        _id: { $ne: user._id },
      });

      if (existingUser) {
        return res.status(400).json({
          success: false,
          message: "Email address is already in use",
        });
      }

      // Generate email change verification token
      const emailChangeToken = tokenUtils.generateEmailVerificationToken();
      const emailChangeExpiry = tokenUtils.generateEmailVerificationExpiry();

      // Store pending email change
      updateData.new_email = email.toLowerCase();
      updateData.email_change_token = emailChangeToken;
      updateData.email_change_expires = emailChangeExpiry;

      // Send verification email to new address
      try {
        await emailService.sendEmailChangeVerification(
          email,
          user.first_name || "User",
          emailChangeToken,
          user.preferred_language || "en"
        );
        emailChangeMessage =
          "A verification email has been sent to your new email address.";
        logger.info(
          `Email change verification sent to ${email} for user ${user.email}`
        );
      } catch (emailError) {
        logger.error(`Failed to send email change verification: ${emailError}`);
        return res.status(500).json({
          success: false,
          message: "Failed to send verification email",
        });
      }
    }

    // Update user with immediate changes
    const updatedUser = await User.findByIdAndUpdate(user._id, updateData, {
      new: true,
      runValidators: true,
    });

    if (!updatedUser) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    logger.info(
      `User ${user.email} updated profile: ${JSON.stringify(updateData)}`
    );

    // Prepare response message
    let message = "Profile updated successfully";
    if (emailChangeMessage) {
      message += `. ${emailChangeMessage}`;
    }

    res.json({
      success: true,
      message,
      data: {
        user: {
          id: updatedUser._id,
          email: updatedUser.email, // Keep current email until verified
          firstName: updatedUser.first_name,
          lastName: updatedUser.last_name,
          profileImageUrl: updatedUser.profile_image_url,
          emailVerified: updatedUser.email_verified,
          creditsBalance: updatedUser.credits_balance,
          preferredLanguage: updatedUser.preferred_language,
          pendingEmailChange: updatedUser.new_email, // Include pending email change
        },
      },
    });
  } catch (error) {
    logger.error(`Update profile error: ${error}`);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

/**
 * Verify email change with token
 */
const verifyEmailChange = async (req, res) => {
  try {
    const { token } = req.query;

    if (!token) {
      return res.status(400).json({
        success: false,
        message: "Email change verification token is required",
      });
    }

    // Find user with the email change token
    const user = await User.findOne({
      email_change_token: token,
      email_change_expires: { $gt: new Date() },
      status: "active",
    });

    if (!user) {
      return res.status(400).json({
        success: false,
        message: "Invalid or expired email change verification token",
      });
    }

    // Check if the new email is still available
    const existingUser = await User.findOne({
      email: user.new_email,
      _id: { $ne: user._id },
    });

    if (existingUser) {
      // Clear the pending email change
      user.new_email = null;
      user.email_change_token = null;
      user.email_change_expires = null;
      await user.save();

      return res.status(400).json({
        success: false,
        message: "Email address is no longer available",
      });
    }

    // Update user's email and clear email change fields
    const oldEmail = user.email;
    user.email = user.new_email;
    user.new_email = null;
    user.email_change_token = null;
    user.email_change_expires = null;
    await user.save();

    logger.info(`Email change verified for user: ${oldEmail} -> ${user.email}`);

    res.json({
      success: true,
      message: "Email address updated successfully",
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
        },
      },
    });
  } catch (error) {
    logger.error(`Verify email change error: ${error}`);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

/**
 * Request password change from profile (sends reset email)
 */
const requestPasswordChange = async (req, res) => {
  try {
    const user = req.user;
    logger.info(`Password change request from profile for user: ${user.email}`);

    // Check rate limiting - max 3 requests per hour (same as forgot password)
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const recentResetRequests = await User.countDocuments({
      email: user.email,
      password_reset_expires: { $gt: oneHourAgo },
    });

    if (recentResetRequests >= 3) {
      logger.warn(
        `Password change rate limit exceeded for user: ${user.email}`
      );
      return res.status(429).json({
        success: false,
        message: "Too many password change requests. Please try again later.",
        code: "AUTH_011",
      });
    }

    // Generate password reset token (reuse existing logic)
    const tokenUtils = require("../utils/tokenUtils");
    const resetToken = tokenUtils.generatePasswordResetToken();
    const resetExpiry = tokenUtils.generatePasswordResetExpiry();

    // Update user with reset token
    user.password_reset_token = resetToken;
    user.password_reset_expires = resetExpiry;
    await user.save();

    logger.info(
      `Password change reset token generated for user: ${user.email}`
    );

    // Send password reset email
    try {
      await emailService.sendPasswordReset(
        user.email,
        user.first_name || "User",
        resetToken,
        user.preferred_language || "en"
      );
      logger.info(`Password change reset email sent to user: ${user.email}`);
    } catch (emailError) {
      logger.error(`Failed to send password change reset email: ${emailError}`);
      return res.status(500).json({
        success: false,
        message: "Failed to send reset email",
      });
    }

    res.json({
      success: true,
      message: "Password reset link has been sent to your email address.",
    });
  } catch (error) {
    logger.error(`Request password change error: ${error}`);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

/**
 * Generate presigned URL for avatar upload
 */
const generateAvatarUploadUrl = async (req, res) => {
  try {
    // Check if user is authenticated
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    const { contentType } = req.body;

    // Validate content type
    if (!contentType || !s3Service.isValidAvatarFileType(contentType)) {
      return res.status(400).json({
        success: false,
        message: "Invalid file type. Only JPG and PNG files are allowed.",
      });
    }

    // Generate S3 key for the avatar
    const fileExtension =
      s3Service.getFileExtensionFromContentType(contentType);
    const s3Key = s3Service.generateAvatarS3Key(
      req.user._id.toString(),
      fileExtension
    );

    // Generate presigned URL (15 minutes expiration)
    const presignedUrl = await s3Service.generatePresignedUploadUrl(
      s3Key,
      contentType,
      900 // 15 minutes
    );

    // Generate the CloudFront URL that will be used after upload
    const cloudFrontUrl = s3Service.generateCloudFrontUrl(s3Key);

    logger.info(`Generated avatar upload URL for user ${req.user.email}`);

    res.json({
      success: true,
      data: {
        uploadUrl: presignedUrl,
        avatarUrl: cloudFrontUrl,
        s3Key: s3Key,
      },
    });
  } catch (error) {
    logger.error(`Generate avatar upload URL error: ${error}`);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

/**
 * Update user's avatar URL after successful upload
 */
const updateAvatarUrl = async (req, res) => {
  try {
    // Check if user is authenticated
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    const { avatarUrl } = req.body;

    // Validate avatar URL
    if (!avatarUrl || typeof avatarUrl !== "string") {
      return res.status(400).json({
        success: false,
        message: "Avatar URL is required",
      });
    }

    // Delete old avatar if it exists
    if (req.user.profile_image_url) {
      try {
        const oldS3Key = s3Service.extractS3KeyFromCloudFrontUrl(
          req.user.profile_image_url
        );
        if (oldS3Key) {
          await s3Service.deleteFile(oldS3Key);
          logger.info(
            `Deleted old avatar for user ${req.user.email}: ${oldS3Key}`
          );
        }
      } catch (deleteError) {
        logger.error(`Failed to delete old avatar: ${deleteError.message}`);
        // Don't fail the update if old file deletion fails
      }
    }

    // Update user's profile image URL
    const updatedUser = await User.findByIdAndUpdate(
      req.user._id,
      { profile_image_url: avatarUrl },
      { new: true, runValidators: true }
    );

    if (!updatedUser) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    logger.info(`Updated avatar for user ${req.user.email}`);

    res.json({
      success: true,
      message: "Avatar updated successfully",
      data: {
        user: {
          id: updatedUser._id,
          email: updatedUser.email,
          firstName: updatedUser.first_name,
          lastName: updatedUser.last_name,
          profileImageUrl: updatedUser.profile_image_url,
          emailVerified: updatedUser.email_verified,
          creditsBalance: updatedUser.credits_balance,
          preferredLanguage: updatedUser.preferred_language,
        },
      },
    });
  } catch (error) {
    logger.error(`Update avatar URL error: ${error}`);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

module.exports = {
  updateLanguagePreference,
  getProfile,
  updateProfile,
  verifyEmailChange,
  requestPasswordChange,
  generateAvatarUploadUrl,
  updateAvatarUrl,
};
