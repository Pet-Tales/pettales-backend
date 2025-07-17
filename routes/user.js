const express = require("express");
const { body } = require("express-validator");
const { userController } = require("../controllers");
const { requireAuth } = require("../middleware");

const router = express.Router();

// Validation rules
const languagePreferenceValidation = [
  body("language")
    .isIn(["en", "es"])
    .withMessage("Language must be either 'en' or 'es'"),
];

const profileUpdateValidation = [
  body("firstName")
    .optional()
    .isLength({ min: 2 })
    .withMessage("First name must be at least 2 characters long")
    .trim(),
  body("lastName")
    .optional()
    .isLength({ min: 2 })
    .withMessage("Last name must be at least 2 characters long")
    .trim(),
  body("email")
    .optional()
    .isEmail()
    .withMessage("Please provide a valid email address")
    .normalizeEmail(),
];

// No validation needed for password change request since it just sends an email

// Get user profile route
router.get("/profile", requireAuth, userController.getProfile);

// Update user profile route
router.put(
  "/profile",
  requireAuth,
  profileUpdateValidation,
  userController.updateProfile
);

// Update language preference route
router.put(
  "/language-preference",
  requireAuth,
  languagePreferenceValidation,
  userController.updateLanguagePreference
);

// Verify email change route
router.get("/verify-email-change", userController.verifyEmailChange);

// Request password change route (sends reset email)
router.post(
  "/request-password-change",
  requireAuth,
  userController.requestPasswordChange
);

// Generate presigned URL for avatar upload
router.post(
  "/avatar/upload-url",
  requireAuth,
  userController.generateAvatarUploadUrl
);

// Update avatar URL after successful upload
router.put("/avatar", requireAuth, userController.updateAvatarUrl);

module.exports = router;
