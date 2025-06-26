/**
 * Centralized error codes and messages for consistent API responses
 */

const ERROR_CODES = {
  // Authentication errors (AUTH_xxx)
  AUTH_001: {
    code: 'AUTH_001',
    message: 'Invalid email or password',
    httpStatus: 401,
  },
  AUTH_002: {
    code: 'AUTH_002', 
    message: 'User not found',
    httpStatus: 404,
  },
  AUTH_003: {
    code: 'AUTH_003',
    message: 'Please verify your email before logging in',
    httpStatus: 403,
  },
  AUTH_004: {
    code: 'AUTH_004',
    message: 'Account suspended',
    httpStatus: 403,
  },
  AUTH_005: {
    code: 'AUTH_005',
    message: 'Session expired',
    httpStatus: 401,
  },
  AUTH_006: {
    code: 'AUTH_006',
    message: 'Authentication required',
    httpStatus: 401,
  },
  AUTH_007: {
    code: 'AUTH_007',
    message: 'Invalid or expired session',
    httpStatus: 401,
  },
  AUTH_008: {
    code: 'AUTH_008',
    message: 'Account is not active',
    httpStatus: 401,
  },
  AUTH_009: {
    code: 'AUTH_009',
    message: 'Already authenticated',
    httpStatus: 400,
  },

  // Registration errors (REG_xxx)
  REG_001: {
    code: 'REG_001',
    message: 'Email already exists',
    httpStatus: 409,
  },
  REG_002: {
    code: 'REG_002',
    message: 'Invalid email format',
    httpStatus: 400,
  },
  REG_003: {
    code: 'REG_003',
    message: 'Password must be at least 6 characters',
    httpStatus: 400,
  },
  REG_004: {
    code: 'REG_004',
    message: 'Passwords do not match',
    httpStatus: 400,
  },

  // Validation errors (VAL_xxx)
  VAL_001: {
    code: 'VAL_001',
    message: 'Email is required',
    httpStatus: 400,
  },
  VAL_002: {
    code: 'VAL_002',
    message: 'Password is required',
    httpStatus: 400,
  },
  VAL_003: {
    code: 'VAL_003',
    message: 'Invalid email address',
    httpStatus: 400,
  },
  VAL_004: {
    code: 'VAL_004',
    message: 'Validation failed',
    httpStatus: 400,
  },

  // Token errors (TOKEN_xxx)
  TOKEN_001: {
    code: 'TOKEN_001',
    message: 'Invalid token',
    httpStatus: 400,
  },
  TOKEN_002: {
    code: 'TOKEN_002',
    message: 'Token expired',
    httpStatus: 400,
  },
  TOKEN_003: {
    code: 'TOKEN_003',
    message: 'Verification token not found',
    httpStatus: 404,
  },

  // Email verification errors (EMAIL_xxx)
  EMAIL_001: {
    code: 'EMAIL_001',
    message: 'Email verification failed',
    httpStatus: 400,
  },
  EMAIL_002: {
    code: 'EMAIL_002',
    message: 'Email already verified',
    httpStatus: 400,
  },
  EMAIL_003: {
    code: 'EMAIL_003',
    message: 'Email verification required',
    httpStatus: 403,
  },

  // Server errors (SERVER_xxx)
  SERVER_001: {
    code: 'SERVER_001',
    message: 'Internal server error',
    httpStatus: 500,
  },
  SERVER_002: {
    code: 'SERVER_002',
    message: 'Service unavailable',
    httpStatus: 503,
  },
  SERVER_003: {
    code: 'SERVER_003',
    message: 'Database error',
    httpStatus: 500,
  },

  // Rate limiting errors (RATE_xxx)
  RATE_001: {
    code: 'RATE_001',
    message: 'Too many requests',
    httpStatus: 429,
  },

  // Language errors (LANG_xxx)
  LANG_001: {
    code: 'LANG_001',
    message: 'Invalid language',
    httpStatus: 400,
  },

  // Generic errors
  GENERIC_001: {
    code: 'GENERIC_001',
    message: 'Bad request',
    httpStatus: 400,
  },
  GENERIC_002: {
    code: 'GENERIC_002',
    message: 'Not found',
    httpStatus: 404,
  },
  GENERIC_003: {
    code: 'GENERIC_003',
    message: 'Forbidden',
    httpStatus: 403,
  },
  GENERIC_004: {
    code: 'GENERIC_004',
    message: 'Conflict',
    httpStatus: 409,
  },
};

/**
 * Create standardized error response
 * @param {string} errorCode - Error code from ERROR_CODES
 * @param {string} customMessage - Optional custom message to override default
 * @param {Object} additionalData - Additional data to include in response
 * @returns {Object} Standardized error response object
 */
const createErrorResponse = (errorCode, customMessage = null, additionalData = {}) => {
  const error = ERROR_CODES[errorCode];
  
  if (!error) {
    // Fallback for unknown error codes
    return {
      success: false,
      message: customMessage || 'Unknown error occurred',
      code: 'UNKNOWN',
      ...additionalData,
    };
  }

  return {
    success: false,
    message: customMessage || error.message,
    code: error.code,
    ...additionalData,
  };
};

/**
 * Send standardized error response
 * @param {Object} res - Express response object
 * @param {string} errorCode - Error code from ERROR_CODES
 * @param {string} customMessage - Optional custom message
 * @param {Object} additionalData - Additional data to include
 */
const sendErrorResponse = (res, errorCode, customMessage = null, additionalData = {}) => {
  const error = ERROR_CODES[errorCode];
  const httpStatus = error?.httpStatus || 500;
  
  const response = createErrorResponse(errorCode, customMessage, additionalData);
  
  return res.status(httpStatus).json(response);
};

/**
 * Handle validation errors from express-validator
 * @param {Object} res - Express response object
 * @param {Array} errors - Validation errors array
 */
const sendValidationErrorResponse = (res, errors) => {
  return res.status(400).json({
    success: false,
    message: 'Validation failed',
    code: 'VAL_004',
    errors: errors.array(),
  });
};

/**
 * Handle database errors
 * @param {Object} res - Express response object
 * @param {Error} error - Database error object
 * @param {string} customMessage - Optional custom message
 */
const sendDatabaseErrorResponse = (res, error, customMessage = null) => {
  // Check for specific MongoDB errors
  if (error.code === 11000) {
    // Duplicate key error
    if (error.keyPattern?.email) {
      return sendErrorResponse(res, 'REG_001');
    }
    return sendErrorResponse(res, 'GENERIC_004', 'Duplicate entry');
  }

  // Generic database error
  return sendErrorResponse(res, 'SERVER_003', customMessage);
};

/**
 * Get error info by code
 * @param {string} errorCode - Error code
 * @returns {Object|null} Error information
 */
const getErrorInfo = (errorCode) => {
  return ERROR_CODES[errorCode] || null;
};

/**
 * Check if error code exists
 * @param {string} errorCode - Error code to check
 * @returns {boolean} True if error code exists
 */
const isValidErrorCode = (errorCode) => {
  return ERROR_CODES.hasOwnProperty(errorCode);
};

module.exports = {
  ERROR_CODES,
  createErrorResponse,
  sendErrorResponse,
  sendValidationErrorResponse,
  sendDatabaseErrorResponse,
  getErrorInfo,
  isValidErrorCode,
};
