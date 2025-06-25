const winston = require("winston");
const DailyRotateFile = require("winston-daily-rotate-file");
const path = require("path");
const fs = require("fs");
const { DEBUG_MODE } = require("./constants");

// Create logs directory if it doesn't exist
const logsDir = path.join(__dirname, "..", "logs");
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Custom format for log messages
const logFormat = winston.format.combine(
  winston.format.timestamp({
    format: "YYYY-MM-DD HH:mm:ss",
  }),
  winston.format.errors({ stack: true }),
  winston.format.printf(({ timestamp, level, message, stack }) => {
    const logLevel = level.toUpperCase().padEnd(5);
    if (stack) {
      return `[${timestamp}] [${logLevel}] ${message}\n${stack}`;
    }
    return `[${timestamp}] [${logLevel}] ${message}`;
  })
);

// File transport with rotation (up to 5MB per file, max 20 files)
const fileTransport = new DailyRotateFile({
  filename: path.join(logsDir, "app.log"),
  datePattern: false, // No date pattern, just use rotation
  maxSize: "5m", // 5MB per file
  maxFiles: 20, // Keep maximum 20 files
  format: logFormat,
  level: DEBUG_MODE ? "debug" : "info",
});

// Console transport (only in debug mode or for errors)
const consoleTransport = new winston.transports.Console({
  format: winston.format.combine(
    winston.format.colorize(),
    winston.format.timestamp({
      format: "YYYY-MM-DD HH:mm:ss",
    }),
    winston.format.printf(({ timestamp, level, message, stack }) => {
      if (stack) {
        return `[${timestamp}] [${level}] ${message}\n${stack}`;
      }
      return `[${timestamp}] [${level}] ${message}`;
    })
  ),
  level: DEBUG_MODE ? "debug" : "error", // Only show errors in production console
});

// Create the winston logger
const logger = winston.createLogger({
  level: DEBUG_MODE ? "debug" : "info",
  format: logFormat,
  transports: [fileTransport, consoleTransport],
  exitOnError: false,
});

// Override console methods to capture all console output
const originalConsole = {
  log: console.log,
  error: console.error,
  warn: console.warn,
  info: console.info,
  debug: console.debug,
};

// Capture console.log and redirect to logger
console.log = (...args) => {
  const message = args
    .map((arg) =>
      typeof arg === "object" ? JSON.stringify(arg, null, 2) : String(arg)
    )
    .join(" ");
  logger.info(message);
  if (DEBUG_MODE) {
    originalConsole.log(...args);
  }
};

// Capture console.error and redirect to logger
console.error = (...args) => {
  const message = args
    .map((arg) =>
      typeof arg === "object" ? JSON.stringify(arg, null, 2) : String(arg)
    )
    .join(" ");
  logger.error(message);
  originalConsole.error(...args); // Always show errors in console
};

// Capture console.warn and redirect to logger
console.warn = (...args) => {
  const message = args
    .map((arg) =>
      typeof arg === "object" ? JSON.stringify(arg, null, 2) : String(arg)
    )
    .join(" ");
  logger.warn(message);
  if (DEBUG_MODE) {
    originalConsole.warn(...args);
  }
};

// Capture console.info and redirect to logger
console.info = (...args) => {
  const message = args
    .map((arg) =>
      typeof arg === "object" ? JSON.stringify(arg, null, 2) : String(arg)
    )
    .join(" ");
  logger.info(message);
  if (DEBUG_MODE) {
    originalConsole.info(...args);
  }
};

// Capture console.debug and redirect to logger
console.debug = (...args) => {
  const message = args
    .map((arg) =>
      typeof arg === "object" ? JSON.stringify(arg, null, 2) : String(arg)
    )
    .join(" ");
  logger.debug(message);
  if (DEBUG_MODE) {
    originalConsole.debug(...args);
  }
};

// Enhanced logger with additional methods
const enhancedLogger = {
  // Standard log levels
  error: (message, meta = {}) => {
    logger.error(message, meta);
  },

  warn: (message, meta = {}) => {
    logger.warn(message, meta);
  },

  info: (message, meta = {}) => {
    logger.info(message, meta);
  },

  debug: (message, meta = {}) => {
    logger.debug(message, meta);
  },

  // Specialized logging methods
  http: (req, res, responseTime) => {
    const message = `${req.method} ${req.originalUrl} - ${res.statusCode} - ${responseTime}ms - ${req.ip}`;
    logger.info(message, {
      method: req.method,
      url: req.originalUrl,
      statusCode: res.statusCode,
      responseTime,
      ip: req.ip,
      userAgent: req.get("User-Agent"),
    });
  },

  auth: (action, email, success = true, details = {}) => {
    const message = `AUTH: ${action} - ${email} - ${
      success ? "SUCCESS" : "FAILED"
    }`;
    if (success) {
      logger.info(message, { action, email, ...details });
    } else {
      logger.warn(message, { action, email, ...details });
    }
  },

  database: (operation, collection, success = true, details = {}) => {
    const message = `DB: ${operation} on ${collection} - ${
      success ? "SUCCESS" : "FAILED"
    }`;
    if (success) {
      logger.info(message, { operation, collection, ...details });
    } else {
      logger.error(message, { operation, collection, ...details });
    }
  },

  payment: (action, amount, currency, success = true, details = {}) => {
    const message = `PAYMENT: ${action} - ${amount} ${currency} - ${
      success ? "SUCCESS" : "FAILED"
    }`;
    if (success) {
      logger.info(message, { action, amount, currency, ...details });
    } else {
      logger.error(message, { action, amount, currency, ...details });
    }
  },

  email: (action, recipient, success = true, details = {}) => {
    const message = `EMAIL: ${action} to ${recipient} - ${
      success ? "SUCCESS" : "FAILED"
    }`;
    if (success) {
      logger.info(message, { action, recipient, ...details });
    } else {
      logger.error(message, { action, recipient, ...details });
    }
  },

  // System events
  system: (event, details = {}) => {
    const message = `SYSTEM: ${event}`;
    logger.info(message, details);
  },

  // Performance logging
  performance: (operation, duration, details = {}) => {
    const message = `PERFORMANCE: ${operation} took ${duration}ms`;
    if (duration > 1000) {
      logger.warn(message, { operation, duration, ...details });
    } else {
      logger.info(message, { operation, duration, ...details });
    }
  },

  // Access to original console methods (for special cases)
  originalConsole,

  // Access to winston logger instance
  winston: logger,
};

// Log system startup
enhancedLogger.system("Logger initialized", {
  debugMode: DEBUG_MODE,
  // logLevel: DEBUG_MODE ? "debug" : "info",
  logLevel: "debug",
  logDirectory: logsDir,
});

module.exports = enhancedLogger;
