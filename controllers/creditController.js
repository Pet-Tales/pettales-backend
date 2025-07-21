const { validationResult } = require("express-validator");
const stripeService = require("../services/stripeService");
const creditService = require("../services/creditService");
const logger = require("../utils/logger");
const { CREDIT_VALUE_USD } = require("../utils/constants");

/**
 * Create a Stripe checkout session for credit purchase
 * @route POST /api/credits/purchase
 * @access Private
 */
const createPurchaseSession = async (req, res) => {
  try {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: errors.array(),
      });
    }

    const { creditAmount, context } = req.body;
    const userId = req.user._id.toString();
    const userEmail = req.user.email;

    // Validate credit amount
    if (!creditAmount || creditAmount <= 0 || !Number.isInteger(creditAmount)) {
      return res.status(400).json({
        success: false,
        message: "Credit amount must be a positive integer",
      });
    }

    // Create Stripe checkout session
    const session = await stripeService.createCreditPurchaseSession(
      userId,
      creditAmount,
      userEmail,
      context
    );

    logger.info(
      `Created purchase session for user ${userId}: ${creditAmount} credits`
    );

    res.status(200).json({
      success: true,
      message: "Checkout session created successfully",
      data: {
        sessionId: session.id,
        url: session.url,
        creditAmount,
        totalAmount: creditAmount * CREDIT_VALUE_USD,
      },
    });
  } catch (error) {
    logger.error(`Create purchase session error: ${error.message}`);
    res.status(500).json({
      success: false,
      message: "Failed to create purchase session",
      error: error.message,
    });
  }
};

/**
 * Verify purchase completion and add credits
 * @route POST /api/credits/verify-purchase
 * @access Private
 */
const verifyPurchase = async (req, res) => {
  try {
    const { sessionId } = req.body;
    const userId = req.user._id.toString();

    if (!sessionId) {
      return res.status(400).json({
        success: false,
        message: "Session ID is required",
      });
    }

    // Retrieve session from Stripe
    const session = await stripeService.retrieveSession(sessionId);

    // Verify session belongs to the user
    if (session.metadata.user_id !== userId) {
      return res.status(403).json({
        success: false,
        message: "Session does not belong to this user",
      });
    }

    // Check if payment was successful
    if (session.payment_status !== "paid") {
      return res.status(400).json({
        success: false,
        message: "Payment not completed",
        paymentStatus: session.payment_status,
      });
    }

    const creditAmount = parseInt(session.metadata.credit_amount);

    // Check if credits have already been added for this payment intent
    const { CreditTransaction } = require("../models");
    const existingTransaction = await CreditTransaction.findOne({
      stripe_payment_intent_id: session.payment_intent,
      type: "purchase",
    });

    if (existingTransaction) {
      logger.info(
        `Credits already added for payment intent ${session.payment_intent}`
      );
      return res.status(200).json({
        success: true,
        message: "Credits already added for this payment",
        data: {
          creditsAdded: creditAmount,
          newBalance: req.user.credits_balance,
          transaction: existingTransaction,
        },
      });
    }

    // Add credits to user account
    const result = await creditService.addCredits(
      userId,
      creditAmount,
      `Purchased ${creditAmount} credits via Stripe`,
      {
        paymentIntentId: session.payment_intent,
        invoiceId: session.invoice,
      }
    );

    logger.info(
      `Purchase verified and credits added for user ${userId}: ${creditAmount} credits`
    );

    res.status(200).json({
      success: true,
      message: "Purchase verified and credits added successfully",
      data: {
        creditsAdded: creditAmount,
        newBalance: result.user.credits_balance,
        transaction: result.transaction,
      },
    });
  } catch (error) {
    logger.error(`Verify purchase error: ${error.message}`);
    res.status(500).json({
      success: false,
      message: "Failed to verify purchase",
      error: error.message,
    });
  }
};

/**
 * Get user's credit transaction history
 * @route GET /api/credits/history
 * @access Private
 */
const getCreditHistory = async (req, res) => {
  try {
    const userId = req.user._id.toString();
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;

    // Validate pagination parameters
    if (page < 1 || limit < 1 || limit > 100) {
      return res.status(400).json({
        success: false,
        message: "Invalid pagination parameters",
      });
    }

    const result = await creditService.getCreditHistory(userId, page, limit);

    res.status(200).json({
      success: true,
      message: "Credit history retrieved successfully",
      data: result,
    });
  } catch (error) {
    logger.error(`Get credit history error: ${error.message}`);
    res.status(500).json({
      success: false,
      message: "Failed to retrieve credit history",
      error: error.message,
    });
  }
};

/**
 * Get user's current credit balance
 * @route GET /api/credits/balance
 * @access Private
 */
const getCreditBalance = async (req, res) => {
  try {
    const userId = req.user._id.toString();

    res.status(200).json({
      success: true,
      message: "Credit balance retrieved successfully",
      data: {
        balance: req.user.credits_balance,
        userId,
      },
    });
  } catch (error) {
    logger.error(`Get credit balance error: ${error.message}`);
    res.status(500).json({
      success: false,
      message: "Failed to retrieve credit balance",
      error: error.message,
    });
  }
};

module.exports = {
  createPurchaseSession,
  verifyPurchase,
  getCreditHistory,
  getCreditBalance,
};
