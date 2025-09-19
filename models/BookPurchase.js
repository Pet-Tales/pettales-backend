const mongoose = require("mongoose");

const bookPurchaseSchema = new mongoose.Schema(
  {
    user_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null, // null for guest purchases
      index: true,
    },
    book_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Book",
      required: true,
      index: true,
    },
    purchase_type: {
      type: String,
      enum: ["download", "print"],
      required: true,
    },
    amount_cents: {
      type: Number,
      required: true,
      min: 0,
    },
    currency: {
      type: String,
      default: "usd",
    },
    stripe_session_id: {
      type: String,
      required: true,
      unique: true,
    },
    stripe_payment_intent_id: {
      type: String,
      default: null,
    },
    status: {
      type: String,
      enum: ["pending", "completed", "failed", "refunded"],
      default: "pending",
      index: true,
    },
    download_count: {
      type: Number,
      default: 0,
    },
    max_downloads: {
      type: Number,
      default: 5,
    },
    expires_at: {
      type: Date,
      default: () => new Date(+new Date() + 30 * 24 * 60 * 60 * 1000), // 30 days
    },
    guest_email: {
      type: String,
      default: null,
      lowercase: true,
      trim: true,
    },
    metadata: {
      page_count: Number,
      is_owner: Boolean,
    },
  },
  {
    timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
  }
);

// Indexes for efficient queries
bookPurchaseSchema.index({ user_id: 1, book_id: 1 });
bookPurchaseSchema.index({ stripe_session_id: 1 });
bookPurchaseSchema.index({ expires_at: 1 }, { expireAfterSeconds: 0 });

// Ensure virtual fields are serialized
bookPurchaseSchema.set("toJSON", {
  virtuals: true,
  transform: function (doc, ret) {
    ret.id = ret._id;
    delete ret._id;
    delete ret.__v;
    
    // Convert to camelCase for frontend
    if (ret.user_id !== undefined) {
      ret.userId = ret.user_id;
      delete ret.user_id;
    }
    if (ret.book_id !== undefined) {
      ret.bookId = ret.book_id;
      delete ret.book_id;
    }
    if (ret.purchase_type !== undefined) {
      ret.purchaseType = ret.purchase_type;
      delete ret.purchase_type;
    }
    if (ret.amount_cents !== undefined) {
      ret.amountCents = ret.amount_cents;
      delete ret.amount_cents;
    }
    if (ret.stripe_session_id !== undefined) {
      ret.stripeSessionId = ret.stripe_session_id;
      delete ret.stripe_session_id;
    }
    if (ret.stripe_payment_intent_id !== undefined) {
      ret.stripePaymentIntentId = ret.stripe_payment_intent_id;
      delete ret.stripe_payment_intent_id;
    }
    if (ret.download_count !== undefined) {
      ret.downloadCount = ret.download_count;
      delete ret.download_count;
    }
    if (ret.max_downloads !== undefined) {
      ret.maxDownloads = ret.max_downloads;
      delete ret.max_downloads;
    }
    if (ret.expires_at !== undefined) {
      ret.expiresAt = ret.expires_at;
      delete ret.expires_at;
    }
    if (ret.guest_email !== undefined) {
      ret.guestEmail = ret.guest_email;
      delete ret.guest_email;
    }
    if (ret.created_at) {
      ret.createdAt = ret.created_at;
      delete ret.created_at;
    }
    if (ret.updated_at) {
      ret.updatedAt = ret.updated_at;
      delete ret.updated_at;
    }
    
    return ret;
  },
});

module.exports = mongoose.model("BookPurchase", bookPurchaseSchema);
