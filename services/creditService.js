const { User, CreditTransaction } = require("../models");
const logger = require("../utils/logger");
const mongoose = require("mongoose");

class CreditService {
  /**
   * Add credits to user account and create transaction record
   * @param {string} userId - User ID
   * @param {number} creditAmount - Number of credits to add
   * @param {string} description - Transaction description
   * @param {Object} metadata - Additional transaction metadata
   * @returns {Promise<Object>} - Updated user and transaction
   */
  async addCredits(userId, creditAmount, description, metadata = {}) {
    logger.info(
      `Adding ${creditAmount} credits to user ${userId}: ${description}`
    );

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // Update user's credit balance
      const user = await User.findByIdAndUpdate(
        userId,
        { $inc: { credits_balance: creditAmount } },
        { new: true, session }
      );

      if (!user) {
        throw new Error("User not found");
      }

      // Create transaction record
      const transaction = await CreditTransaction.create(
        [
          {
            user_id: userId,
            type: "purchase",
            amount: creditAmount,
            description,
            stripe_payment_intent_id: metadata.paymentIntentId || null,
            stripe_invoice_id: metadata.invoiceId || null,
            coupon_code: metadata.couponCode || null,
            discount_amount: metadata.discountAmount || null,
          },
        ],
        { session }
      );

      await session.commitTransaction();

      logger.info(
        `Added ${creditAmount} credits to user ${userId}. New balance: ${user.credits_balance}`
      );

      return {
        user,
        transaction: transaction[0],
      };
    } catch (error) {
      await session.abortTransaction();
      logger.error(`Failed to add credits to user ${userId}: ${error.message}`);
      throw error;
    } finally {
      session.endSession();
    }
  }

  /**
   * Deduct credits from user account and create transaction record
   * @param {string} userId - User ID
   * @param {number} creditAmount - Number of credits to deduct
   * @param {string} description - Transaction description
   * @param {Object} metadata - Additional transaction metadata
   * @returns {Promise<Object>} - Updated user and transaction
   */
  async deductCredits(userId, creditAmount, description, metadata = {}) {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // Check if user has enough credits
      const user = await User.findById(userId).session(session);
      if (!user) {
        throw new Error("User not found");
      }

      if (user.credits_balance < creditAmount) {
        throw new Error("Insufficient credits");
      }

      // Update user's credit balance
      const updatedUser = await User.findByIdAndUpdate(
        userId,
        { $inc: { credits_balance: -creditAmount } },
        { new: true, session }
      );

      // Create transaction record
      const transaction = await CreditTransaction.create(
        [
          {
            user_id: userId,
            type: "usage",
            amount: -creditAmount, // Negative for usage
            description,
            book_id: metadata.bookId || null,
          },
        ],
        { session }
      );

      await session.commitTransaction();

      logger.info(
        `Deducted ${creditAmount} credits from user ${userId}. New balance: ${updatedUser.credits_balance}`
      );

      return {
        user: updatedUser,
        transaction: transaction[0],
      };
    } catch (error) {
      await session.abortTransaction();
      logger.error(
        `Failed to deduct credits from user ${userId}: ${error.message}`
      );
      throw error;
    } finally {
      session.endSession();
    }
  }

  /**
   * Refund credits to user account and create transaction record
   * @param {string} userId - User ID
   * @param {number} creditAmount - Number of credits to refund
   * @param {string} description - Transaction description
   * @param {Object} metadata - Additional transaction metadata
   * @returns {Promise<Object>} - Updated user and transaction
   */
  async refundCredits(userId, creditAmount, description, metadata = {}) {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // Update user's credit balance
      const user = await User.findByIdAndUpdate(
        userId,
        { $inc: { credits_balance: creditAmount } },
        { new: true, session }
      );

      if (!user) {
        throw new Error("User not found");
      }

      // Create transaction record
      const transaction = await CreditTransaction.create(
        [
          {
            user_id: userId,
            type: "refund",
            amount: creditAmount,
            description,
            book_id: metadata.bookId || null,
          },
        ],
        { session }
      );

      await session.commitTransaction();

      logger.info(
        `Refunded ${creditAmount} credits to user ${userId}. New balance: ${user.credits_balance}`
      );

      return {
        user,
        transaction: transaction[0],
      };
    } catch (error) {
      await session.abortTransaction();
      logger.error(
        `Failed to refund credits to user ${userId}: ${error.message}`
      );
      throw error;
    } finally {
      session.endSession();
    }
  }

  /**
   * Get user's credit transaction history
   * @param {string} userId - User ID
   * @param {number} page - Page number (1-based)
   * @param {number} limit - Number of transactions per page
   * @returns {Promise<Object>} - Paginated transaction history
   */
  async getCreditHistory(userId, page = 1, limit = 20) {
    try {
      const skip = (page - 1) * limit;

      const [transactions, total] = await Promise.all([
        CreditTransaction.find({ user_id: userId })
          .sort({ created_at: -1 })
          .skip(skip)
          .limit(limit)
          .populate("book_id", "title")
          .lean(),
        CreditTransaction.countDocuments({ user_id: userId }),
      ]);

      const totalPages = Math.ceil(total / limit);

      return {
        transactions,
        pagination: {
          currentPage: page,
          totalPages,
          totalTransactions: total,
          hasNextPage: page < totalPages,
          hasPrevPage: page > 1,
        },
      };
    } catch (error) {
      logger.error(
        `Failed to get credit history for user ${userId}: ${error.message}`
      );
      throw error;
    }
  }

  /**
   * Check if user has sufficient credits
   * @param {string} userId - User ID
   * @param {number} requiredCredits - Required credit amount
   * @returns {Promise<boolean>} - Whether user has sufficient credits
   */
  async hasSufficientCredits(userId, requiredCredits) {
    try {
      const user = await User.findById(userId).select("credits_balance");
      if (!user) {
        throw new Error("User not found");
      }

      return user.credits_balance >= requiredCredits;
    } catch (error) {
      logger.error(
        `Failed to check credits for user ${userId}: ${error.message}`
      );
      throw error;
    }
  }
}

module.exports = new CreditService();
