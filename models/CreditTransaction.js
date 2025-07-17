const mongoose = require("mongoose");

const creditTransactionSchema = new mongoose.Schema(
  {
    user_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: ["purchase", "usage", "refund"],
      required: true,
    },
    amount: {
      type: Number,
      required: true,
      // Positive for purchases/refunds, negative for usage
    },
    description: {
      type: String,
      required: true,
    },
    stripe_payment_intent_id: {
      type: String,
      default: null,
      // For purchase transactions
    },
    book_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Book",
      default: null,
      // For usage transactions
    },
    stripe_invoice_id: {
      type: String,
      default: null,
      // For purchase transactions
    },
    coupon_code: {
      type: String,
      default: null,
      // For purchases with coupons (future use)
    },
    discount_amount: {
      type: Number,
      default: null,
      // For purchases with coupons (future use)
    },
  },
  {
    timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
  }
);

// Indexes for efficient queries
creditTransactionSchema.index({ user_id: 1, created_at: -1 });
creditTransactionSchema.index({ type: 1 });
creditTransactionSchema.index({ stripe_payment_intent_id: 1 });

module.exports = mongoose.model("CreditTransaction", creditTransactionSchema);
