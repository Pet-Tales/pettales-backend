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

const { handleStripeWebhook } = require("./controllers/stripeWebhookController");

validateRequiredEnvVars();
checkOptionalEnvVars();

// Initialize app
const app = express();

// Middleware
app.use("/api/webhook/stripe", express.raw({ type: "application/json" })); // 🔹 Add this line
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(cors({ origin: WEB_URL, credentials: true }));
app.use(passport.initialize());
if (DEBUG_MODE) app.use(morgan("dev"));

// Connect database
connectDB();

// Routes
app.use("/api", routes);

// Stripe webhook (registered separately)
app.post("/api/webhook/stripe", handleStripeWebhook);

// Health endpoint
app.get("/health", (req, res) => {
  res.status(200).json({ status: "ok", timestamp: new Date().toISOString() });
});

// Error handler
app.use((err, req, res, next) => {
  logger.error("Unhandled error", err);
  res.status(500).json({ error: err.message });
});

const port = PORT || 5000;
app.listen(port, () => {
  logger.info(`Server running on port ${port}`);

  // 🩹 Safely start background services without crashing if missing
  if (sessionCleanup) {
    if (typeof sessionCleanup === "function") {
      sessionCleanup();
    } else if (typeof sessionCleanup.start === "function") {
      sessionCleanup.start();
    } else {
      logger.warn("Session cleanup service not started (no valid export found)");
    }
  }

  if (webhookLifecycleService && typeof webhookLifecycleService.start === "function") {
    webhookLifecycleService.start();
  } else {
    logger.warn("Webhook lifecycle service not started (no valid export found)");
  }
});

module.exports = app;
