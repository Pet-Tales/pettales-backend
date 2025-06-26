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

// Update language preference route
router.put(
  "/language-preference",
  requireAuth,
  languagePreferenceValidation,
  userController.updateLanguagePreference
);

// Get user profile route
router.get("/profile", requireAuth, userController.getProfile);

module.exports = router;
