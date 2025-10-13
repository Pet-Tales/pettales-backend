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

// Validate environment variables
validateRequiredEnvVars();
checkOptionalEnvVars();

// Connect to MongoDB
connectDB();

// Initialize Express
const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(morgan(DEBUG_MODE ? "dev" : "combined"));
app.use(passport.initialize());

// Routes
app.use("/api", routes);

// Health check
app.get("/health", (req, res) => {
  res.status(200).send("OK");
});

// Start webhook lifecycle service
webhookLifecycleService.start();

// Cleanup old sessions periodically
sessionCleanup.start();

// Start server
app.listen(PORT, () => {
  logger.info(`Server running at ${WEB_URL}:${PORT}`);
});
