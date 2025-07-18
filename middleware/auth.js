const { Session } = require("../models");
const logger = require("../utils/logger");
const { sendErrorResponse } = require("../utils/errorCodes");

/**
 * Middleware to authenticate user based on session token
 * Adds user information to req.user if authenticated
 */
const authenticateUser = async (req, _res, next) => {
  try {
    const sessionToken = req.cookies.session_token;

    if (!sessionToken) {
      logger.debug("Auth middleware - No session token found", {
        cookies: Object.keys(req.cookies),
        url: req.url,
        userAgent: req.get("User-Agent"),
      });
      req.user = null;
      return next();
    }

    // Find valid session
    const session = await Session.findOne({
      session_token: sessionToken,
      expires_at: { $gt: new Date() },
    }).populate("user_id");

    if (!session || !session.user_id) {
      logger.debug("Auth middleware - Invalid session or no user", {
        sessionFound: !!session,
        sessionToken: sessionToken.substring(0, 10) + "...",
        url: req.url,
      });
      req.user = null;
      return next();
    }

    // Check if user is active
    if (session.user_id.status !== "active") {
      logger.warn("Auth middleware - User not active", {
        email: session.user_id.email,
      });
      req.user = null;
      return next();
    }

    logger.auth("session_validate", session.user_id.email, true, {
      ip: req.ip,
    });
    req.user = session.user_id;
    req.session = session;
    next();
  } catch (error) {
    logger.error(`Authentication middleware error: ${error}`);
    req.user = null;
    next();
  }
};

/**
 * Middleware to require authentication
 * Returns 401 if user is not authenticated
 */
const requireAuth = async (req, res, next) => {
  try {
    const sessionToken = req.cookies.session_token;

    if (!sessionToken) {
      return sendErrorResponse(res, "AUTH_006");
    }

    // Find valid session
    const session = await Session.findOne({
      session_token: sessionToken,
      expires_at: { $gt: new Date() },
    }).populate("user_id");

    if (!session || !session.user_id) {
      return sendErrorResponse(res, "AUTH_007");
    }

    // Check if user is active
    if (session.user_id.status !== "active") {
      return sendErrorResponse(res, "AUTH_008");
    }

    req.user = session.user_id;
    req.session = session;
    next();
  } catch (error) {
    logger.error(`RequireAuth middleware error: ${error}`);
    return res.status(500).json({
      success: false,
      message: "Authentication error",
    });
  }
};

/**
 * Middleware to require email verification
 * Returns 403 if user email is not verified
 */
const requireEmailVerification = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: "Authentication required",
    });
  }

  if (!req.user.email_verified) {
    return res.status(403).json({
      success: false,
      message: "Email verification required",
      code: "EMAIL_NOT_VERIFIED",
    });
  }

  next();
};

/**
 * Middleware to check if user is already authenticated
 * Returns 400 if user is already logged in (for login/register routes)
 */
const requireGuest = (req, res, next) => {
  if (req.user) {
    return res.status(400).json({
      success: false,
      message: "Already authenticated",
    });
  }
  next();
};

module.exports = {
  authenticateUser,
  requireAuth,
  requireEmailVerification,
  requireGuest,
};
