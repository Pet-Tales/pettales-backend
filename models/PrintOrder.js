const mongoose = require("mongoose");

const printOrderSchema = new mongoose.Schema(
  {
    user_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    book_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Book",
      required: true,
    },
    lulu_print_job_id: {
      type: String,
      unique: true,
      sparse: true,
    },
    external_id: {
      type: String,
      unique: true,
      required: true,
    },

    // Order Details
    quantity: {
      type: Number,
      required: true,
      min: 1,
      max: 100,
    },
    total_cost_credits: {
      type: Number,
      required: true,
      min: 0,
    },

    // GBP + Stripe + Lulu tracking (replaces old lulu_cost_usd)
    lulu_cost_gbp: {
      type: Number,
      required: true,
      min: 0,
    },
    total_cost_cents: {
      type: Number,
      required: true,
      min: 0,
    },

    // Stripe tracking fields
    stripe_session_id: {
      type: String,
      unique: true,
      sparse: true,
      index: true,
    },
    stripe_payment_intent_id: {
      type: String,
      index: true,
    },

    // Lulu submission tracking
    lulu_submission_status: {
      type: String,
      enum: ["pending", "submitting", "submitted", "failed", "retry_needed"],
      default: "pending",
    },
    lulu_submission_attempts: {
      type: Number,
      default: 0,
    },
    lulu_submission_error: {
      type: String,
      default: null,
    },
    lulu_submitted_at: {
      type: Date,
      default: null,
    },

    markup_percentage: {
      type: Number,
      default: 20,
      min: 0,
      max: 100,
    },

    // Shipping Information
    shipping_address: {
      name: { type: String, required: true, trim: true },
      street1: { type: String, required: true, trim: true },
      street2: { type: String, trim: true, default: null },
      city: { type: String, required: true, trim: true },
      state_code: { type: String, trim: true, default: null },
      postcode: { type: String, required: true, trim: true },
      country_code: { type: String, required: true, length: 2, uppercase: true },
      phone_number: { type: String, required: true, trim: true },
      email: { type: String, required: true, lowercase: true, trim: true },
    },
    shipping_level: {
      type: String,
      enum: ["MAIL", "PRIORITY_MAIL", "GROUND", "EXPEDITED", "EXPRESS"],
      required: true,
    },

    // Status & Tracking
    status: {
      type: String,
      enum: [
        "created",
        "unpaid",
        "payment_in_progress",
        "production_delayed",
        "production_ready",
        "in_production",
        "shipped",
        "rejected",
        "canceled",
      ],
      default: "created",
    },
    tracking_info: {
      tracking_id: { type: String, default: null },
      tracking_urls: { type: [String], default: [] },
      carrier_name: { type: String, default: null },
    },

    // PDF Files
    cover_pdf_url: { type: String, default: null },
    interior_pdf_url: { type: String, default: null },

    // Error Handling
    error_message: { type: String, default: null },
    retry_count: { type: Number, default: 0, min: 0, max: 3 },

    // Timestamps
    ordered_at: { type: Date, default: null },
    shipped_at: { type: Date, default: null },
    estimated_delivery: { type: Date, default: null },

    // Credit Transaction Reference
    credit_transaction_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "CreditTransaction",
      default: null,
    },
  },
  {
    timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
  }
);

printOrderSchema.index({ user_id: 1, created_at: -1 });
printOrderSchema.index({ status: 1 });
printOrderSchema.index({ book_id: 1 });

printOrderSchema.pre("save", function (next) {
  if (!this.external_id) {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8).toUpperCase();
    this.external_id = `PTO_${timestamp}_${random}`;
  }
  next();
});

printOrderSchema.virtual("formatted_order_id").get(function () {
  return this.external_id;
});

printOrderSchema.virtual("total_cost_usd").get(function () {
  return this.total_cost_credits * 0.01;
});

printOrderSchema.virtual("order_age_days").get(function () {
  if (!this.created_at) return 0;
  const now = new Date();
  const diffTime = Math.abs(now - this.created_at);
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
});

printOrderSchema.methods.canBeCanceled = function () {
  return ["created", "unpaid"].includes(this.status);
};

printOrderSchema.methods.isInProgress = function () {
  return [
    "payment_in_progress",
    "production_delayed",
    "production_ready",
    "in_production",
  ].includes(this.status);
};

printOrderSchema.methods.isCompleted = function () {
  return this.status === "shipped";
};

printOrderSchema.methods.hasFailed = function () {
  return ["rejected", "canceled"].includes(this.status);
};

printOrderSchema.statics.findByUser = function (userId, options = {}) {
  const query = this.find({ user_id: userId });
  if (options.status) query.where({ status: options.status });
  if (options.limit) query.limit(options.limit);
  return query.sort({ created_at: -1 }).populate("book_id", "title");
};

printOrderSchema.statics.findByStatus = function (status) {
  return this.find({ status }).populate("user_id book_id");
};

module.exports = mongoose.model("PrintOrder", printOrderSchema);
