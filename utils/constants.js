require("dotenv").config();

/**
 * Centralized environment variables and constants
 * All environment variables should be loaded here and exported
 */

// Server Configuration
const PORT = process.env.PORT || 8080;
const DEBUG_MODE = process.env.DEBUG_MODE_ENV !== "false";

// URLs
const WEB_URL = process.env.WEB_URL || "http://127.0.0.1:5173";
const API_BASE_URL = process.env.API_BASE_URL || "http://127.0.0.1:8080";

// Database
const MONGODB_URI = process.env.MONGODB_URI;

// Authentication & Security
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN;
const JWT_SECRET = process.env.JWT_SECRET;
const SESSION_SECRET = process.env.SESSION_SECRET;

// Google OAuth
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;

// AWS Configuration
const AWS_REGION = process.env.AWS_REGION;
const AWS_ACCESS_KEY_ID = process.env.AWS_ACCESS_KEY_ID;
const AWS_SECRET_ACCESS_KEY = process.env.AWS_SECRET_ACCESS_KEY;
const S3_BUCKET_NAME = process.env.S3_BUCKET_NAME;
const CLOUDFRONT_URL = process.env.CLOUDFRONT_URL;

// Email Configuration
const NO_REPLY_EMAIL_ADDRESS = process.env.NO_REPLY_EMAIL_ADDRESS;
const FROM_NAME = process.env.FROM_NAME || "PetTalesAI";
const CONTACT_EMAIL_ADDRESS = process.env.CONTACT_EMAIL_ADDRESS;

// Stripe Configuration
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
const STRIPE_PUBLIC_KEY = process.env.STRIPE_PUBLIC_KEY;
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;

// Stripe Product IDs for downloads
const STRIPE_PRICE_DOWNLOAD_12 = process.env.STRIPE_PRICE_DOWNLOAD_12;
const STRIPE_PRICE_DOWNLOAD_16 = process.env.STRIPE_PRICE_DOWNLOAD_16;
const STRIPE_PRICE_DOWNLOAD_24 = process.env.STRIPE_PRICE_DOWNLOAD_24;

// Download Pricing (in cents - for display/reference only, actual prices are in Stripe)
const DOWNLOAD_PRICES = {
  12: 299,  // $2.99
  16: 399,  // $3.99
  24: 499,  // $4.99
};

// Webhook Configuration
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET;

// AWS Lambda Configuration
const AWS_LAMBDA_FUNCTION_NAME = process.env.AWS_LAMBDA_FUNCTION_NAME;

// Replicate Configuration
const REPLICATE_API_TOKEN = process.env.REPLICATE_API_TOKEN;

// Lulu API Configuration
const LULU_CLIENT_KEY = process.env.LULU_CLIENT_KEY;
const LULU_CLIENT_SECRET = process.env.LULU_CLIENT_SECRET;
const LULU_API_BASE_URL =
  process.env.LULU_API_BASE_URL || "https://api.lulu.com";
const LULU_SANDBOX_API_BASE_URL =
  process.env.LULU_SANDBOX_API_BASE_URL || "https://api.sandbox.lulu.com";
const LULU_ENVIRONMENT = process.env.LULU_ENVIRONMENT || "sandbox";
const LULU_POD_PACKAGE_ID =
  process.env.LULU_POD_PACKAGE_ID || "0750X0750FCPRESS080CW444MXX";
const LULU_WEBHOOK_SECRET = process.env.LULU_WEBHOOK_SECRET;
const LULU_WEBHOOK_URL = process.env.LULU_WEBHOOK_URL;
const LULU_BASE64_ENCODED_KEY_SECRET = process.env.LULU_BASE64_ENCODED_KEY_SECRET;

// Illustration Styles (force prod URLs; do NOT read from env)
const ILLUST_ANIME =
  "https://storage.pettales.ai/_static/illustration_styles/illust_anime_9.jpg";

const ILLUST_DISNEY =
  "https://storage.pettales.ai/_static/illustration_styles/illust_disney_9.jpg";

const ILLUST_VECTOR_ART =
  "https://storage.pettales.ai/_static/illustration_styles/illust_vector_art_9.jpg";

const ILLUST_CLASSIC_WATERCOLOR =
  "https://storage.pettales.ai/_static/illustration_styles/illust_classic_watercolor_1.png";


// Application Constants
const DEFAULT_CREDITS_BALANCE = 10;  // DEPRECATED - keeping for migration reference only
const SESSION_EXPIRY_DAYS = 7;
const EMAIL_VERIFICATION_EXPIRY_HOURS = 24;
const PASSWORD_RESET_EXPIRY_HOURS = 1;

// DEPRECATED - Credit System Constants (removed but kept commented for reference during migration)
// const CREDIT_COSTS = {
//   BOOK_12_PAGES: 400,
//   BOOK_16_PAGES: 450,
//   BOOK_24_PAGES: 500,
//   ILLUSTRATION_REGENERATION: 16,
//   PDF_DOWNLOAD: 100,
// };
// const FREE_REGENERATION_LIMITS = {
//   12: 3,
//   16: 4,
//   24: 5,
// };
// const CREDIT_VALUE_USD = 0.01;
// const LOW_CREDIT_THRESHOLD = 100;

// Print Markup Configuration (for Lulu print orders)
const PRINT_MARKUP_PERCENTAGE = parseFloat(process.env.PRINT_MARKUP_PERCENTAGE || "100"); // 100% default markup
const SHIPPING_MARKUP_PERCENTAGE = parseFloat(process.env.SHIPPING_MARKUP_PERCENTAGE || "5"); // 5% shipping markup

// Determine if we're in local development (not staging or production)
const IS_LOCAL_DEV =
  DEBUG_MODE &&
  (WEB_URL.includes("127.0.0.1") || WEB_URL.includes("localhost"));

// Cookie Configuration
const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: !DEBUG_MODE, // Secure cookies in production (when DEBUG_MODE is false)
  sameSite: "lax",
  path: "/",
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  // Only set domain for local development, let staging/production use default domain
  ...(IS_LOCAL_DEV ? { domain: "127.0.0.1" } : {}),
};

// Cookie clear options (without maxAge for clearing)
const COOKIE_CLEAR_OPTIONS = {
  httpOnly: true,
  secure: !DEBUG_MODE,
  sameSite: "lax",
  path: "/",
  // Only set domain for local development, let staging/production use default domain
  ...(IS_LOCAL_DEV ? { domain: "127.0.0.1" } : {}),
};

// Validation
const validateRequiredEnvVars = () => {
  const required = [
    { name: "MONGODB_URI", value: MONGODB_URI },
    { name: "WEB_URL", value: WEB_URL },
    { name: "LULU_CLIENT_KEY", value: LULU_CLIENT_KEY },
    { name: "LULU_CLIENT_SECRET", value: LULU_CLIENT_SECRET },
  ];

  // Optional but recommended for webhook functionality
  const webhookRequired = [
    { name: "LULU_WEBHOOK_SECRET", value: LULU_WEBHOOK_SECRET },
    { name: "LULU_WEBHOOK_URL", value: LULU_WEBHOOK_URL },
  ];

  const missing = required.filter((env) => !env.value);
  const missingWebhook = webhookRequired.filter((env) => !env.value);

  if (missing.length > 0) {
    logger.error("Missing required environment variables:");
    missing.forEach((env) => logger.error(`- ${env.name}`));
    process.exit(1);
  }

  if (missingWebhook.length > 0) {
    logger.warn("Missing webhook-related environment variables (webhook functionality will be limited):");
    missingWebhook.forEach((env) => logger.warn(`- ${env.name}`));
  }
};

// Optional environment variables warnings
const checkOptionalEnvVars = () => {
  const optional = [
    {
      name: "GOOGLE_CLIENT_ID",
      value: GOOGLE_CLIENT_ID,
      feature: "Google OAuth",
    },
    {
      name: "AWS_ACCESS_KEY_ID",
      value: AWS_ACCESS_KEY_ID,
      feature: "Email service",
    },
    {
      name: "STRIPE_SECRET_KEY",
      value: STRIPE_SECRET_KEY,
      feature: "Payment processing",
    },
  ];

  optional.forEach((env) => {
    if (!env.value) {
      logger.warn(
        `Warning: ${env.name} not provided - ${env.feature} will be disabled`
      );
    }
  });
};

module.exports = {
  // Server
  PORT,
  DEBUG_MODE,

  // URLs
  WEB_URL,
  API_BASE_URL,

  // Database
  MONGODB_URI,

  // Authentication
  JWT_EXPIRES_IN,
  JWT_SECRET,
  SESSION_SECRET,

  // Google OAuth
  GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET,

  // AWS
  AWS_REGION,
  AWS_ACCESS_KEY_ID,
  AWS_SECRET_ACCESS_KEY,
  S3_BUCKET_NAME,
  CLOUDFRONT_URL,

  // Email
  NO_REPLY_EMAIL_ADDRESS,
  FROM_NAME,
  CONTACT_EMAIL_ADDRESS,

  // Stripe
  STRIPE_SECRET_KEY,
  STRIPE_PUBLIC_KEY,
  STRIPE_WEBHOOK_SECRET,
  STRIPE_PRICE_DOWNLOAD_12,
  STRIPE_PRICE_DOWNLOAD_16,
  STRIPE_PRICE_DOWNLOAD_24,

  // Download Pricing
  DOWNLOAD_PRICES,

  // Webhook
  WEBHOOK_SECRET,

  // AWS Lambda
  AWS_LAMBDA_FUNCTION_NAME,

  // Replicate
  REPLICATE_API_TOKEN,

  // Lulu API
  LULU_CLIENT_KEY,
  LULU_CLIENT_SECRET,
  LULU_API_BASE_URL,
  LULU_SANDBOX_API_BASE_URL,
  LULU_ENVIRONMENT,
  LULU_POD_PACKAGE_ID,
  LULU_WEBHOOK_SECRET,
  LULU_WEBHOOK_URL,
  LULU_BASE64_ENCODED_KEY_SECRET,

  // Illustration Styles
  ILLUST_ANIME,
  ILLUST_DISNEY,
  ILLUST_VECTOR_ART,
  ILLUST_CLASSIC_WATERCOLOR,

  // Application Constants
  DEFAULT_CREDITS_BALANCE,  // DEPRECATED
  SESSION_EXPIRY_DAYS,
  EMAIL_VERIFICATION_EXPIRY_HOURS,
  PASSWORD_RESET_EXPIRY_HOURS,

  // Print Configuration
  PRINT_MARKUP_PERCENTAGE,
  SHIPPING_MARKUP_PERCENTAGE,

  // Cookie Configuration
  COOKIE_OPTIONS,
  COOKIE_CLEAR_OPTIONS,
  IS_LOCAL_DEV,

  // Validation functions
  validateRequiredEnvVars,
  checkOptionalEnvVars,
};
