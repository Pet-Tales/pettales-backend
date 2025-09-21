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
      enum: [
        "download-12",
        "download-16",
        "download-24",
        "print-12",
        "print-16",
        "print-24"
      ],
      required: true,
      index: true, // Added index for faster entitlement queries
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
    // Download tracking fields (only relevant for download access)
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
    // Shipping information (for print orders)
    shipping_address: {
      name: String,
      line1: String,
      line2: String,
      city: String,
      state: String,
      postal_code: String,
      country: String,
    },
    lulu_order_id: {
      type: String,
      default: null,
    },
    metadata: {
      page_count: Number,
      is_owner: Boolean,
      // Track if this is a complementary download from a print purchase
      is_complementary_download: {
        type: Boolean,
        default: false,
      },
      // If this is a complementary download, reference the parent print purchase
      parent_purchase_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "BookPurchase",
        default: null,
      },
    },
  },
  {
    timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
  }
);

// Indexes for efficient queries
bookPurchaseSchema.index({ user_id: 1, book_id: 1, purchase_type: 1 });
bookPurchaseSchema.index({ user_id: 1, book_id: 1, status: 1 });
bookPurchaseSchema.index({ stripe_session_id: 1 });
bookPurchaseSchema.index({ expires_at: 1 }, { expireAfterSeconds: 0 });

// Virtual to check if this purchase grants download access
bookPurchaseSchema.virtual("grants_download").get(function () {
  // All purchase types grant download access
  // (downloads directly, prints include download)
  return this.status === "completed" && this.expires_at > new Date();
});

// Virtual to check if this is a print purchase
bookPurchaseSchema.virtual("is_print").get(function () {
  return this.purchase_type?.startsWith("print-");
});

// Virtual to check if this is a download purchase
bookPurchaseSchema.virtual("is_download").get(function () {
  return this.purchase_type?.startsWith("download-");
});

// Method to get page count from purchase type
bookPurchaseSchema.methods.getPageCount = function () {
  const match = this.purchase_type?.match(/(\d+)$/);
  return match ? parseInt(match[1]) : null;
};

// Static method to check if user has any valid purchase for a book
bookPurchaseSchema.statics.hasValidPurchase = async function (bookId, userId) {
  const purchase = await this.findOne({
    book_id: bookId,
    user_id: userId,
    status: "completed",
    expires_at: { $gt: new Date() },
  });
  return !!purchase;
};

// Static method to get user's entitlements for a book
bookPurchaseSchema.statics.getUserEntitlements = async function (bookId, userId) {
  const purchases = await this.find({
    book_id: bookId,
    user_id: userId,
    status: "completed",
  }).sort({ created_at: -1 });

  const entitlements = {
    hasDownload: false,
    hasPrint: false,
    downloadType: null,
    printType: null,
    canDownload: false,
    downloadPurchaseDate: null,
    printPurchaseDate: null,
    downloadsRemaining: 0,
    expiresAt: null,
  };

  for (const purchase of purchases) {
    if (purchase.is_download && !entitlements.hasDownload) {
      entitlements.hasDownload = true;
      entitlements.downloadType = purchase.purchase_type;
      entitlements.downloadPurchaseDate = purchase.created_at;
      
      // Check if download is still valid
      if (purchase.expires_at > new Date() && 
          purchase.download_count < purchase.max_downloads) {
        entitlements.canDownload = true;
        entitlements.downloadsRemaining = purchase.max_downloads - purchase.download_count;
        entitlements.expiresAt = purchase.expires_at;
      }
    }
    
    if (purchase.is_print && !entitlements.hasPrint) {
      entitlements.hasPrint = true;
      entitlements.printType = purchase.purchase_type;
      entitlements.printPurchaseDate = purchase.created_at;
      
      // Print purchases always grant download access
      if (!entitlements.hasDownload) {
        entitlements.hasDownload = true;
        entitlements.downloadType = purchase.purchase_type.replace('print-', 'download-');
        entitlements.canDownload = true;
        entitlements.downloadsRemaining = purchase.max_downloads - purchase.download_count;
        entitlements.expiresAt = purchase.expires_at;
      }
    }
  }

  return entitlements;
};

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
    if (ret.shipping_address !== undefined) {
      ret.shippingAddress = ret.shipping_address;
      delete ret.shipping_address;
    }
    if (ret.lulu_order_id !== undefined) {
      ret.luluOrderId = ret.lulu_order_id;
      delete ret.lulu_order_id;
    }
    if (ret.created_at) {
      ret.createdAt = ret.created_at;
      delete ret.created_at;
    }
    if (ret.updated_at) {
      ret.updatedAt = ret.updated_at;
      delete ret.updated_at;
    }
    
    // Include virtuals in response
    if (ret.grants_download !== undefined) {
      ret.grantsDownload = ret.grants_download;
      delete ret.grants_download;
    }
    if (ret.is_print !== undefined) {
      ret.isPrint = ret.is_print;
      delete ret.is_print;
    }
    if (ret.is_download !== undefined) {
      ret.isDownload = ret.is_download;
      delete ret.is_download;
    }
    
    return ret;
  },
});

module.exports = mongoose.model("BookPurchase", bookPurchaseSchema);
