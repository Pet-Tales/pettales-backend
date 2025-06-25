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

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// API Request Logging
if (DEBUG_MODE) {
  // Detailed logging for development
  app.use(morgan("dev"));
} else {
  // Concise logging for production
  app.use(morgan("common"));
}

app.use(
  cors({
    origin: [WEB_URL],
    credentials: true, // Allow cookies
  })
);

// Initialize passport
app.use(passport.initialize());

// Add user context to all requests
app.use(authenticateUser);

// Routes
app.use("/api", routes);

app.get("/health", (req, res) => {
  const environment = DEBUG_MODE ? "Staging" : "Production";
  const message = `Hello, World! - ${environment} Environment`;
  logger.info(`Health check accessed from ${req.ip}`);
  res.send(message);
});

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

app
  .listen(PORT, () => {
    logger.system(`Server started successfully`, {
      port: PORT,
      environment: DEBUG_MODE ? "development" : "production",
      url: `http://127.0.0.1:${PORT}`,
    });
  })
  .on("error", (err) => {
    logger.error(`Server startup error: ${err}`);
    process.exit(1);
  });
