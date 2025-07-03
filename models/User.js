const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const userSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    password_hash: {
      type: String,
      required: function () {
        return !this.google_id; // Required only if not Google auth
      },
    },
    google_id: {
      type: String,
      unique: true,
      sparse: true, // Allows multiple null values
    },
    first_name: {
      type: String,
      required: false,
      trim: true,
      default: "",
    },
    last_name: {
      type: String,
      required: false,
      trim: true,
      default: "",
    },
    profile_image_url: {
      type: String,
      default: null,
    },
    email_verified: {
      type: Boolean,
      default: false,
    },
    email_verification_token: {
      type: String,
      default: null,
    },
    email_verification_expires: {
      type: Date,
      default: null,
    },
    new_email: {
      type: String,
      default: null,
      lowercase: true,
      trim: true,
    },
    email_change_token: {
      type: String,
      default: null,
    },
    email_change_expires: {
      type: Date,
      default: null,
    },
    password_reset_token: {
      type: String,
      default: null,
    },
    password_reset_expires: {
      type: Date,
      default: null,
    },
    credits_balance: {
      type: Number,
      default: 0,
      min: 0,
    },
    preferred_language: {
      type: String,
      enum: ["en", "es"],
      default: "en",
    },
    status: {
      type: String,
      enum: ["active", "suspended", "deleted"],
      default: "active",
    },
    deleted_at: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
  }
);

// Additional indexes (email and google_id already have unique indexes from schema definition)
userSchema.index({ email_verification_token: 1 });
userSchema.index({ password_reset_token: 1 });

// Hash password before saving
userSchema.pre("save", async function (next) {
  if (!this.isModified("password_hash") || !this.password_hash) {
    return next();
  }

  try {
    const salt = await bcrypt.genSalt(12);
    this.password_hash = await bcrypt.hash(this.password_hash, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Compare password method
userSchema.methods.comparePassword = async function (candidatePassword) {
  if (!this.password_hash) {
    return false;
  }
  return bcrypt.compare(candidatePassword, this.password_hash);
};

// Get full name
userSchema.virtual("full_name").get(function () {
  return `${this.first_name} ${this.last_name}`;
});

// Ensure virtual fields are serialized
userSchema.set("toJSON", {
  virtuals: true,
  transform: function (doc, ret) {
    delete ret.password_hash;
    delete ret.email_verification_token;
    delete ret.password_reset_token;
    return ret;
  },
});

module.exports = mongoose.model("User", userSchema);
