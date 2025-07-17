const mongoose = require("mongoose");

const characterSchema = new mongoose.Schema(
  {
    user_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    character_name: {
      type: String,
      required: true,
      trim: true,
      minlength: [2, "Character name must be at least 2 characters long"],
    },
    character_type: {
      type: String,
      required: true,
      enum: ["human", "pet"],
    },
    // Human character fields
    age: {
      type: Number,
      required: function () {
        return this.character_type === "human";
      },
      min: [0, "Age must be a positive number"],
      validate: {
        validator: function (value) {
          // Only validate if this is a human character
          if (this.character_type === "human") {
            return value != null && value >= 0;
          }
          return true;
        },
        message: "Age is required for human characters",
      },
    },
    gender: {
      type: String,
      enum: ["boy", "girl", "male", "female"],
      required: true, // Now required for both human and pet characters
      validate: {
        validator: function (value) {
          // Validate based on character type
          if (this.character_type === "human") {
            return value != null && ["boy", "girl"].includes(value);
          }
          // For pet characters, gender is now required and must be valid
          if (this.character_type === "pet") {
            return value != null && ["male", "female"].includes(value);
          }
          return true;
        },
        message: function (props) {
          if (this.character_type === "human") {
            return "Gender is required for human characters and must be 'boy' or 'girl'";
          }
          return "Gender is required for pet characters and must be 'male' or 'female'";
        },
      },
    },
    ethnicity: {
      type: String,
      trim: true,
      required: function () {
        return this.character_type === "human";
      },
      validate: {
        validator: function (value) {
          // Only validate if this is a human character
          if (this.character_type === "human") {
            return value != null && value.trim().length > 0;
          }
          return true;
        },
        message: "Ethnicity is required for human characters",
      },
    },
    hair_color: {
      type: String,
      trim: true,
      default: null,
    },
    eye_color: {
      type: String,
      trim: true,
      default: null,
    },
    // Pet character fields
    pet_type: {
      type: String,
      trim: true,
      required: function () {
        return this.character_type === "pet";
      },
      validate: {
        validator: function (value) {
          // Only validate if this is a pet character
          if (this.character_type === "pet") {
            return value != null && value.trim().length > 0;
          }
          return true;
        },
        message: "Pet type is required for pet characters",
      },
    },
    breed: {
      type: String,
      trim: true,
      required: function () {
        return this.character_type === "pet";
      },
      validate: {
        validator: function (value) {
          // Only validate if this is a pet character
          if (this.character_type === "pet") {
            return value != null && value.trim().length > 0;
          }
          return true;
        },
        message: "Breed is required for pet characters",
      },
    },
    fur: {
      type: String,
      trim: true,
      default: null,
    },
    ears: {
      type: String,
      trim: true,
      default: null,
    },
    tail: {
      type: String,
      trim: true,
      default: null,
    },
    // Common fields
    personality: {
      type: String,
      trim: true,
      default: null,
    },
    reference_image_url: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
  }
);

// Indexes for efficient queries
characterSchema.index({ user_id: 1, created_at: -1 }); // For user's characters list with pagination
characterSchema.index({ user_id: 1, character_type: 1 }); // For filtering by type

// Pre-save validation to ensure type-specific fields are properly set
characterSchema.pre("save", function (next) {
  if (this.character_type === "human") {
    // Clear pet-specific fields for human characters
    this.pet_type = null;
    this.breed = null;
    this.fur = null;
    this.ears = null;
    this.tail = null;
  } else if (this.character_type === "pet") {
    // Clear human-specific fields for pet characters (except gender which is now shared)
    this.age = null;
    this.ethnicity = null;
    this.hair_color = null;
    this.eye_color = null;
  }
  next();
});

// Virtual for character display name (for consistency)
characterSchema.virtual("display_name").get(function () {
  return this.character_name;
});

// Ensure virtual fields are serialized
characterSchema.set("toJSON", {
  virtuals: true,
  transform: function (doc, ret) {
    // Convert _id to id for frontend consistency
    ret.id = ret._id;
    delete ret._id;
    delete ret.__v;

    // Convert user_id to userId for frontend consistency
    if (ret.user_id) {
      ret.userId = ret.user_id;
      delete ret.user_id;
    }

    // Convert field names to camelCase for frontend consistency
    if (ret.character_name) {
      ret.characterName = ret.character_name;
      delete ret.character_name;
    }

    if (ret.character_type) {
      ret.characterType = ret.character_type;
      delete ret.character_type;
    }

    if (ret.pet_type) {
      ret.petType = ret.pet_type;
      delete ret.pet_type;
    }

    if (ret.hair_color) {
      ret.hairColor = ret.hair_color;
      delete ret.hair_color;
    }

    if (ret.eye_color) {
      ret.eyeColor = ret.eye_color;
      delete ret.eye_color;
    }

    if (ret.reference_image_url) {
      ret.referenceImageUrl = ret.reference_image_url;
      delete ret.reference_image_url;
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

module.exports = mongoose.model("Character", characterSchema);
