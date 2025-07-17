const express = require("express");
const router = express.Router();
const creditController = require("../controllers/creditController");
const { requireAuth } = require("../middleware");
const {
  createPurchaseValidation,
  verifyPurchaseValidation,
  creditHistoryValidation,
} = require("../middleware/creditValidation");

/**
 * @route POST /api/credits/purchase
 * @desc Create Stripe checkout session for credit purchase
 * @access Private
 */
router.post(
  "/purchase",
  requireAuth,
  createPurchaseValidation,
  creditController.createPurchaseSession
);

/**
 * @route POST /api/credits/verify-purchase
 * @desc Verify purchase completion and add credits to user account
 * @access Private
 */
router.post(
  "/verify-purchase",
  requireAuth,
  verifyPurchaseValidation,
  creditController.verifyPurchase
);

/**
 * @route GET /api/credits/history
 * @desc Get user's credit transaction history
 * @access Private
 */
router.get(
  "/history",
  requireAuth,
  creditHistoryValidation,
  creditController.getCreditHistory
);

/**
 * @route GET /api/credits/balance
 * @desc Get user's current credit balance
 * @access Private
 */
router.get("/balance", requireAuth, creditController.getCreditBalance);

module.exports = router;
