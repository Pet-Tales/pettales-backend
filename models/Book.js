const mongoose = require("mongoose");

const bookSchema = new mongoose.Schema(
  {
    user_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      required: true,
      trim: true,
    },
    dedication: {
      type: String,
      trim: true,
      default: null,
    },
    moral: {
      type: String,
      required: true,
      trim: true,
    },
    moral_of_back_cover: {
      type: String,
      trim: true,
      default: null,
    },
    language: {
      type: String,
      required: true,
      enum: ["en", "es"], // Must match supported languages
    },
    page_count: {
      type: Number,
      required: true,
      enum: [12, 16, 24],
    },
    illustration_style: {
      type: String,
      required: true,
      enum: ["anime", "disney", "vector_art"],
    },
    character_ids: {
      type: [mongoose.Schema.Types.ObjectId],
      ref: "Character",
      required: true,
      validate: {
        validator: function (arr) {
          return arr.length <= 3 && arr.length > 0;
        },
        message: "Must have between 1 and 3 characters",
      },
    },
    front_cover_image_url: {
      type: String,
      default: null,
    },
    alternative_front_covers: {
      type: [String],
      default: [],
    },
    back_cover_image_url: {
      type: String,
      default: null,
    },
    alternative_back_covers: {
      type: [String],
      default: [],
    },
    is_public: {
      type: Boolean,
      default: false,
    },
    generation_status: {
      type: String,
      enum: ["pending", "generating", "completed", "failed"],
      default: "pending",
    },
    credits_used: {
      type: Number,
      default: null,
    },
    pdf_url: {
      type: String,
      default: null,
    },
    canva_design_id: {
      type: String,
      default: null,
    },
    lulu_order_id: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
  }
);

// Indexes
bookSchema.index({ user_id: 1, created_at: -1 });
bookSchema.index({ generation_status: 1 });
bookSchema.index({ is_public: 1, created_at: -1 });

module.exports = mongoose.model("Book", bookSchema);
