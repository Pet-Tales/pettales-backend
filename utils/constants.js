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

// Stripe Configuration
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
const STRIPE_PUBLIC_KEY = process.env.STRIPE_PUBLIC_KEY;
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;

// Webhook Configuration
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET;

// AWS Lambda Configuration
const AWS_LAMBDA_FUNCTION_NAME = process.env.AWS_LAMBDA_FUNCTION_NAME;

// Replicate Configuration
const REPLICATE_API_TOKEN = process.env.REPLICATE_API_TOKEN;

// Illustration Styles
const ILLUST_ANIME =
  process.env.ILLUST_ANIME ||
  "https://storage-staging.pettales.ai/_static/illustration_styles/illust_anime_9.jpg";
const ILLUST_DISNEY =
  process.env.ILLUST_DISNEY ||
  "https://storage-staging.pettales.ai/_static/illustration_styles/illust_disney_9.jpg";
const ILLUST_VECTOR_ART =
  process.env.ILLUST_VECTOR_ART ||
  "https://storage-staging.pettales.ai/_static/illustration_styles/illust_vector_art_9.jpg";

// Application Constants
const DEFAULT_CREDITS_BALANCE = 10;
const SESSION_EXPIRY_DAYS = 7;
const EMAIL_VERIFICATION_EXPIRY_HOURS = 24;
const PASSWORD_RESET_EXPIRY_HOURS = 1;

// Cookie Configuration
const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: !DEBUG_MODE, // Secure cookies in production (when DEBUG_MODE is false)
  sameSite: "lax",
  path: "/",
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  domain: DEBUG_MODE ? "127.0.0.1" : undefined, // Share cookies across ports in development
};

// Validation
const validateRequiredEnvVars = () => {
  const required = [
    { name: "MONGODB_URI", value: MONGODB_URI },
    { name: "WEB_URL", value: WEB_URL },
  ];

  const missing = required.filter((env) => !env.value);

  if (missing.length > 0) {
    logger.error("Missing required environment variables:");
    missing.forEach((env) => logger.error(`- ${env.name}`));
    process.exit(1);
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

  // Stripe
  STRIPE_SECRET_KEY,
  STRIPE_PUBLIC_KEY,
  STRIPE_WEBHOOK_SECRET,

  // Webhook
  WEBHOOK_SECRET,

  // AWS Lambda
  AWS_LAMBDA_FUNCTION_NAME,

  // Replicate
  REPLICATE_API_TOKEN,

  // Illustration Styles
  ILLUST_ANIME,
  ILLUST_DISNEY,
  ILLUST_VECTOR_ART,

  // Application Constants
  DEFAULT_CREDITS_BALANCE,
  SESSION_EXPIRY_DAYS,
  EMAIL_VERIFICATION_EXPIRY_HOURS,
  PASSWORD_RESET_EXPIRY_HOURS,

  // Cookie Configuration
  COOKIE_OPTIONS,

  // Validation functions
  validateRequiredEnvVars,
  checkOptionalEnvVars,
};
