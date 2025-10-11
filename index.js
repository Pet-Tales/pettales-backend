const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const morgan = require("morgan");
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

// Validate env vars
validateRequiredEnvVars();
checkOptionalEnvVars();

// Connect database
connectDB();

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Logging
if (DEBUG_MODE) {
  app.use(morgan("dev"));
} else {
  app.use(morgan("common"));
}

// CORS
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

// Passport
app.use(passport.initialize());

// Auth middleware
app.use(authenticateUser);

// Main routes
app.use("/api", routes);

// Health check
app.get("/health", (req, res) => {
  const environment = DEBUG_MODE ? "Staging" : "Production";
  const message = `Greetings from PetTalesAI! - ${environment} Environment`;
  logger.info(`Health check accessed from ${req.ip}`);
  res.send(message);
});

// Debug (optional)
if (DEBUG_MODE) {
  app.get("/debug/cookies", (req, res) => {
    res.json({
      cookies: req.cookies,
      headers: req.headers,
      user: req.user || null,
    });
  });
}

// Error handling
app.use((err, _req, res, _next) => {
  logger.error(`Unhandled error: ${err}`);
  res.status(500).json({
    success: false,
    message: "Internal server error",
  });
});

// Start session cleanup
sessionCleanup.startSessionCleanup();

// Webhook lifecycle init
const initializeWebhookService = async () => {
  try {
    logger.info("Initializing webhook lifecycle service...");
    await webhookLifecycleService.initialize();
    logger.info("Webhook lifecycle service initialized successfully");
  } catch (error) {
    logger.error("Failed to initialize webhook lifecycle service:", error);
    logger.warn(
      "Server will continue without webhook registration. Use admin panel to register manually."
    );
  }
};

app
  .listen(PORT, async () => {
    logger.system(`Server started successfully`, {
      port: PORT,
      environment: DEBUG_MODE ? "development" : "production",
      url: `http://127.0.0.1:${PORT}`,
    });
    await initializeWebhookService();
  })
  .on("error", (err) => {
    logger.error(`Server startup error: ${err}`);
    process.exit(1);
  });

// Graceful shutdown
process.on("SIGTERM", async () => {
  logger.info("SIGTERM received, shutting down gracefully");
  try {
    await webhookLifecycleService.cleanup();
    logger.info("Webhook lifecycle service cleaned up");
  } catch (error) {
    logger.error("Error during webhook cleanup:", error);
  }
  process.exit(0);
});

process.on("SIGINT", async () => {
  logger.info("SIGINT received, shutting down gracefully");
  try {
    await webhookLifecycleService.cleanup();
    logger.info("Webhook lifecycle service cleaned up");
  } catch (error) {
    logger.error("Error during webhook cleanup:", error);
  }
  process.exit(0);
});
