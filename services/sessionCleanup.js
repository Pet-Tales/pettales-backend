const { Session } = require("../models");
const logger = require("../utils/logger");

/**
 * Clean up expired sessions from the database
 */
const cleanupExpiredSessions = async () => {
  try {
    const result = await Session.deleteMany({
      expires_at: { $lt: new Date() },
    });

    if (result.deletedCount > 0) {
      logger.info(`Cleaned up ${result.deletedCount} expired sessions`);
    }

    return result.deletedCount;
  } catch (error) {
    logger.error(`Error cleaning up expired sessions: ${error}`);
    throw error;
  }
};

/**
 * Clean up sessions for a specific user (useful for logout all devices)
 */
const cleanupUserSessions = async (userId) => {
  try {
    const result = await Session.deleteMany({
      user_id: userId,
    });

    logger.info(
      `Cleaned up ${result.deletedCount} sessions for user ${userId}`
    );
    return result.deletedCount;
  } catch (error) {
    logger.error(`Error cleaning up user sessions: ${error}`);
    throw error;
  }
};

/**
 * Start automatic session cleanup interval
 * Runs every hour to clean up expired sessions
 */
const startSessionCleanup = () => {
  // Clean up immediately on start
  cleanupExpiredSessions();

  // Set up interval to run every hour (3600000 ms)
  const interval = setInterval(() => {
    cleanupExpiredSessions();
  }, 3600000);

  logger.info("Session cleanup service started - running every hour");

  return interval;
};

module.exports = {
  cleanupExpiredSessions,
  cleanupUserSessions,
  startSessionCleanup,
};
