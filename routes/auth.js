const express = require("express");
const { body } = require("express-validator");
const passport = require("../config/passport");
const { authController } = require("../controllers");
const { requireGuest, authenticateUser } = require("../middleware");
const {
  GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET,
  WEB_URL,
} = require("../utils/constants");

const router = express.Router();

// Validation rules
const registerValidation = [
  body("email")
    .isEmail()
    .normalizeEmail()
    .withMessage("Please provide a valid email address"),
  body("password")
    .isLength({ min: 6 })
    .withMessage("Password must be at least 6 characters long"),
  body("preferred_language")
    .optional()
    .isIn(["en", "es"])
    .withMessage("Language must be either 'en' or 'es'"),
];

const loginValidation = [
  body("email")
    .isEmail()
    .normalizeEmail()
    .withMessage("Please provide a valid email address"),
  body("password").notEmpty().withMessage("Password is required"),
];

const forgotPasswordValidation = [
  body("email")
    .isEmail()
    .normalizeEmail()
    .withMessage("Please provide a valid email address"),
];

const resetPasswordValidation = [
  body("token").notEmpty().withMessage("Reset token is required"),
  body("password")
    .isLength({ min: 6 })
    .withMessage("Password must be at least 6 characters long"),
];

// Register route
router.post(
  "/register",
  requireGuest,
  registerValidation,
  authController.register
);

// Login route
router.post("/login", requireGuest, loginValidation, authController.login);

// Logout route
router.post("/logout", authController.logout);

// Email verification route
router.get("/verify-email", authController.verifyEmail);

// Resend email verification
router.post("/resend-verification", authController.resendEmailVerification);

// Forgot password route
router.post(
  "/forgot-password",
  requireGuest,
  forgotPasswordValidation,
  authController.requestPasswordReset
);

// Reset password route (allow both authenticated and guest users)
router.post(
  "/reset-password",
  resetPasswordValidation,
  authController.resetPassword
);

// Get current user
router.get("/me", authenticateUser, authController.getCurrentUser);

// Google OAuth routes (only if Google OAuth is configured)
if (GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET) {
  router.get(
    "/google",
    requireGuest,
    (req, res, next) => {
      // Pass redirect parameter through OAuth state
      const redirectPath = req.query.redirect;
      if (redirectPath) {
        // Store redirect in a temporary cookie that expires in 10 minutes
        const { DEBUG_MODE, IS_LOCAL_DEV } = require("../utils/constants");
        res.cookie("oauth_redirect", redirectPath, {
          httpOnly: true,
          secure: !DEBUG_MODE,
          sameSite: "lax",
          maxAge: 10 * 60 * 1000, // 10 minutes
          ...(IS_LOCAL_DEV ? { domain: "127.0.0.1" } : {}),
        });
      }
      next();
    },
    passport.authenticate("google", {
      scope: ["profile", "email"],
    })
  );

  router.get(
    "/google/callback",
    passport.authenticate("google", {
      session: false,
      failureRedirect: `${WEB_URL}/login?error=auth_failed`,
    }),
    authController.googleCallback
  );
} else {
  // Return error if Google OAuth is not configured
  router.get("/google", (req, res) => {
    res.status(503).json({
      success: false,
      message: "Google OAuth is not configured",
    });
  });
}

module.exports = router;
