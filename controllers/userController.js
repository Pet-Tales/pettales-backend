const { validationResult } = require("express-validator");
const { User } = require("../models");
const logger = require("../utils/logger");

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

    logger.info(`User ${req.user.email} updated language preference to ${language}`);

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
          notificationPreferences: req.user.notification_preferences,
          createdAt: req.user.created_at,
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

module.exports = {
  updateLanguagePreference,
  getProfile,
};
