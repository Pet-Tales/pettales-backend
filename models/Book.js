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
    front_cover_prompt: {
      type: String,
      trim: true,
      default: null,
    },
    back_cover_prompt: {
      type: String,
      trim: true,
      default: null,
    },
    generation_seed: {
      type: Number,
      default: null,
      min: 0,
      max: 4294967295, // 32-bit unsigned integer max value
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
    pdf_needs_regeneration: {
      type: Boolean,
      default: false,
      index: true,
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

// Ensure virtual fields are serialized
bookSchema.set("toJSON", {
  virtuals: true,
  transform: function (doc, ret) {
    // Convert _id to id for frontend consistency
    ret.id = ret._id;
    delete ret._id;
    delete ret.__v;

    // Convert field names to camelCase for frontend consistency
    if (ret.user_id) {
      ret.userId = ret.user_id;
      delete ret.user_id;
    }

    if (ret.generation_status) {
      ret.generationStatus = ret.generation_status;
      delete ret.generation_status;
    }

    if (ret.page_count) {
      ret.pageCount = ret.page_count;
      delete ret.page_count;
    }

    if (ret.character_ids) {
      ret.characterIds = ret.character_ids;
      delete ret.character_ids;
    }

    if (ret.front_cover_image_url) {
      ret.frontCoverImageUrl = ret.front_cover_image_url;
      delete ret.front_cover_image_url;
    }

    if (ret.alternative_front_covers) {
      ret.alternativeFrontCovers = ret.alternative_front_covers;
      delete ret.alternative_front_covers;
    }

    if (ret.back_cover_image_url) {
      ret.backCoverImageUrl = ret.back_cover_image_url;
      delete ret.back_cover_image_url;
    }

    if (ret.alternative_back_covers) {
      ret.alternativeBackCovers = ret.alternative_back_covers;
      delete ret.alternative_back_covers;
    }

    if (ret.pdf_url) {
      ret.pdfUrl = ret.pdf_url;
      delete ret.pdf_url;
    }

    if (ret.pdf_needs_regeneration !== undefined) {
      ret.pdfNeedsRegeneration = ret.pdf_needs_regeneration;
      delete ret.pdf_needs_regeneration;
    }

    if (ret.is_public !== undefined) {
      ret.isPublic = ret.is_public;
      delete ret.is_public;
    }

    if (ret.moral_of_back_cover) {
      ret.moralOfBackCover = ret.moral_of_back_cover;
      delete ret.moral_of_back_cover;
    }

    if (ret.front_cover_prompt) {
      ret.frontCoverPrompt = ret.front_cover_prompt;
      delete ret.front_cover_prompt;
    }

    if (ret.back_cover_prompt) {
      ret.backCoverPrompt = ret.back_cover_prompt;
      delete ret.back_cover_prompt;
    }

    if (ret.illustration_style) {
      ret.illustrationStyle = ret.illustration_style;
      delete ret.illustration_style;
    }

    if (ret.created_at) {
      ret.createdAt = ret.created_at;
      delete ret.created_at;
    }

    if (ret.updated_at) {
      ret.updatedAt = ret.updated_at;
      delete ret.updated_at;
    }

    if (ret.deleted_at) {
      ret.deletedAt = ret.deleted_at;
      delete ret.deleted_at;
    }

    return ret;
  },
});

module.exports = mongoose.model("Book", bookSchema);
