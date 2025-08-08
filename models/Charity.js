const mongoose = require("mongoose");

// Simple slugify helper without external deps
function slugify(text) {
  return String(text || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "") // remove non alphanum
    .replace(/[\s_-]+/g, "-") // collapse whitespace/underscores
    .replace(/^-+|-+$/g, ""); // trim dashes
}

const charitySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    description: { type: String, default: "" },
    website_url: { type: String, default: "" },
    logo_url: { type: String, default: "" },
    is_enabled: { type: Boolean, default: false, index: true },
    sort_order: { type: Number, default: 0 },
    language_tags: { type: [String], default: [] }, // e.g., ['en','es']
  },
  { timestamps: { createdAt: "created_at", updatedAt: "updated_at" } }
);

// Unique index on slug
charitySchema.index({ slug: 1 }, { unique: true });
charitySchema.index({ is_enabled: 1, sort_order: 1 });

// Auto-generate slug from name if not provided
charitySchema.pre("validate", function (next) {
  if (!this.slug && this.name) {
    this.slug = slugify(this.name);
  }
  next();
});

module.exports = mongoose.model("Charity", charitySchema);

