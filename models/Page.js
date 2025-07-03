const mongoose = require("mongoose");

const pageSchema = new mongoose.Schema(
  {
    book_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Book",
      required: true,
      index: true,
    },
    book_page_number: {
      type: Number,
      required: true,
    },
    story_page_number: {
      type: Number,
      required: true,
    },
    page_type: {
      type: String,
      required: true,
      enum: ["text", "illustration"],
    },
    // Text page fields
    text_content: {
      type: String,
      required: function() {
        return this.page_type === "text";
      },
      trim: true,
    },
    // Illustration page fields
    illustration_url: {
      type: String,
      required: function() {
        return this.page_type === "illustration";
      },
    },
    illustration_prompt: {
      type: String,
      required: function() {
        return this.page_type === "illustration";
      },
      trim: true,
    },
    alternative_illustrations: {
      type: [String],
      default: [],
      validate: {
        validator: function(value) {
          // Only illustration pages should have alternative illustrations
          if (this.page_type === "text" && value.length > 0) {
            return false;
          }
          return true;
        },
        message: "Alternative illustrations are only allowed for illustration pages",
      },
    },
  },
  {
    timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
  }
);

// Indexes
pageSchema.index({ book_id: 1, book_page_number: 1 });
pageSchema.index({ book_id: 1, story_page_number: 1 });
pageSchema.index({ book_id: 1, page_type: 1 }); // For filtering by page type

// Ensure virtual fields are serialized
pageSchema.set("toJSON", {
  virtuals: true,
  transform: function (doc, ret) {
    // Convert _id to id for frontend consistency
    ret.id = ret._id;
    delete ret._id;
    delete ret.__v;

    // Transform field names to camelCase for frontend
    if (ret.book_id) {
      ret.bookId = ret.book_id;
      delete ret.book_id;
    }

    if (ret.book_page_number) {
      ret.bookPageNumber = ret.book_page_number;
      delete ret.book_page_number;
    }

    if (ret.story_page_number) {
      ret.storyPageNumber = ret.story_page_number;
      delete ret.story_page_number;
    }

    if (ret.page_type) {
      ret.pageType = ret.page_type;
      delete ret.page_type;
    }

    if (ret.text_content) {
      ret.textContent = ret.text_content;
      delete ret.text_content;
    }

    if (ret.illustration_url) {
      ret.illustrationUrl = ret.illustration_url;
      delete ret.illustration_url;
    }

    if (ret.illustration_prompt) {
      ret.illustrationPrompt = ret.illustration_prompt;
      delete ret.illustration_prompt;
    }

    if (ret.alternative_illustrations) {
      ret.alternativeIllustrations = ret.alternative_illustrations;
      delete ret.alternative_illustrations;
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

module.exports = mongoose.model("Page", pageSchema);
