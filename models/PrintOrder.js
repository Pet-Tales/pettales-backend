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
      sparse: true, // Allows null values but ensures uniqueness when present
    },
    external_id: {
      type: String,
      required: false,
      default: () => `order_${Date.now()}`,
    },
    quantity: {
      type: Number,
      required: true,
      default: 1,
    },
    shipping_address: {
      name: String,
      street1: String,
      street2: String,
      city: String,
      state_code: String,
      postcode: String,
      country_code: String,
      phone_number: String,
      email: String,
    },
    shipping_level: { type: String, default: "MAIL" },

    // --- Old credit system fields (optional) ---
    lulu_cost_usd: { type: Number, required: false },
    total_cost_credits: { type: Number, required: false },

    // --- Cost & currency info ---
    lulu_cost_gbp: { type: Number },
    lulu_print_cost: { type: Number },
    lulu_shipping_cost: { type: Number },
    total_cost_gbp: { type: Number },
    currency: { type: String, default: "GBP" },

    // --- Order status ---
    status: {
      type: String,
      enum: ["created", "paid", "printing", "shipped", "delivered", "cancelled"],
      default: "created",
    },

    // --- Lulu API response ---
    lulu_response: { type: Object },

    // --- Timestamps ---
    created_at: { type: Date, default: Date.now },
    updated_at: { type: Date, default: Date.now },
  },
  {
    collection: "printorders",
  }
);

printOrderSchema.pre("save", function (next) {
  this.updated_at = new Date();
  next();
});

module.exports = mongoose.model("PrintOrder", printOrderSchema);
