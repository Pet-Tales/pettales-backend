const mongoose = require("mongoose");

const charityDonationSchema = new mongoose.Schema(
  {
    book_id: { type: mongoose.Schema.Types.ObjectId, ref: "Book", required: true, index: true },
    user_id: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null, index: true },
    guest_email: { type: String, default: null },
    charity_id: { type: mongoose.Schema.Types.ObjectId, ref: "Charity", required: true, index: true },

    amount_cents: { type: Number, required: true, min: 0 },
    currency: { type: String, default: "usd" },

    stripe_session_id: { type: String, required: true, unique: true },
    stripe_payment_intent_id: { type: String, default: null },

    status: { type: String, enum: ["pending", "paid", "failed"], default: "pending", index: true },
  },
  { timestamps: { createdAt: "created_at", updatedAt: "updated_at" } }
);

// Avoid duplicate documents by unique stripe_session_id
charityDonationSchema.index({ stripe_session_id: 1 }, { unique: true });

module.exports = mongoose.model("CharityDonation", charityDonationSchema);

