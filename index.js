// index.js
const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const morgan = require("morgan");
const bodyParser = require("body-parser");

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

// ✅ Import Stripe webhook handler
const { handleStripeWebhook } = require("./webhooks/stripeWebhook");

validateRequiredEnvVars();
checkOptionalEnvVars();
connectDB();

const app = express();

// ✅ CORS first
app.use(cors({ origin: WEB_URL, credentials: true }));

// ✅ Stripe webhook route BEFORE body parsing middleware
app.post(
  "/api/webhook/stripe",
  bodyParser.raw({ type: "application/json" }),
  handleStripeWebhook
);

// ✅ Everything else uses normal JSON parsing
app.use(express.json({ limit: "50mb" }));
app.use(cookieParser());
app.use(morgan("dev"));
app.use(passport.initialize());

// ✅ Mount your normal routes
app.use("/api", routes);

// ✅ Health check
app.get("/health", (req, res) => res.status(200).json({ status: "ok" }));

// ✅ Error handling middleware
app.use((err, req, res, next) => {
  logger.error(err);
  res.status(500).json({ message: "Internal server error", error: err.message });
});

// ✅ Start server
app.listen(PORT, () => {
  logger.info(`🚀 Server running on port ${PORT}`);
  sessionCleanup();
  webhookLifecycleService.start();
});
