const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const morgan = require("morgan");
// Initialize logger early to capture all console output
const logger = require("./utils/logger");
const passport = require("./config/passport");
const connectDB = require("./config/database");
const routes = require("./routes");
const { authenticateUser } = require("./middleware");
const { sessionCleanup } = require("./services");
const webhookLifecycleService = require("./services/webhookLifecycleService");
const {
  PORT,
  DEBUG_MODE,
  WEB_URL,
  validateRequiredEnvVars,
  checkOptionalEnvVars,
} = require("./utils/constants");

const app = express();

// Validate environment variables
validateRequiredEnvVars();
checkOptionalEnvVars();

// Connect to database
connectDB();

/* ============================================================
   🔔 Mount webhook routes BEFORE body parsers
   ============================================================ */
app.use("/api/webhook", require("./routes/webhook"));

/* ============================================================
   NORMAL MIDDLEWARE (runs AFTER webhooks)
   ============================================================ */
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// API Request Logging
if (DEBUG_MODE) {
  app.use(morgan("dev"));
} else {
  app.use(morgan("common"));
}

// CORS configuration - allow multiple origins in production
const corsOrigins = DEBUG_MODE
  ? [WEB_URL]
  : [
      "https://pettales.ai",
      "https://www.pettales.ai",
      "https://staging.pettales.ai",
      WEB_URL,
    ].filter(Boolean);

app.use(
  cors({
    origin: corsOrigins,
    credentials: true,
  })
);

// Initialize passport
app.use(passport.initialize());

// Add user context to all requests
app.use(authenticateUser);

/* ============================================================
   MAIN API ROUTES
   ============================================================ */
app.use("/api", routes);

app.get("/health", (req, res) => {
  const environment = DEBUG_MODE ? "Staging" : "Production";
  const message = `Greetings from PetTalesAI! - ${environment} Environment`;
  logger.info(`Health check accessed from ${req.ip}`);
  res.send(message);
});

// Debug endpoint to check cookies (only in debug mode)
if (DEBUG_MODE) {
  app.get("/debug/cookies", (req, res) => {
    res.json({
      cookies: req.cookies,
      headers: {
        cookie: req.headers.cookie,
        origin: req.headers.origin,
        referer: req.headers.referer,
        userAgent: req.headers["user-agent"],
      },
      user: req.user ? { id: req.user._id, email: req.user.email } : null,
    });
  });
}

// Error handling middleware
app.use((err, _req, res, _next) => {
  logger.error(`Unhandled error: ${err}`);
  res.status(500).json({
    success: false,
    message: "Internal server error",
  });
});

// Start session cleanup service
sessionCleanup.startSessionCleanup();

// Initialize webhook lifecycle service
const initializeWebhookService = async () => {
  try {
    logger.info("Initializing webhook lifecycle service...");
    await webhookLifecycleService.initialize();
    logger.info("Webhook lifecycle service initialized successfully");
  } catch (error) {
    logger.error("Failed t
