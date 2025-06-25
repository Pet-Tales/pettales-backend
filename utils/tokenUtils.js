const crypto = require("crypto");
const {
  SESSION_EXPIRY_DAYS,
  EMAIL_VERIFICATION_EXPIRY_HOURS,
  PASSWORD_RESET_EXPIRY_HOURS,
} = require("./constants");

/**
 * Generate a random session token
 * @returns {string} Session token with 'sess_' prefix
 */
const generateSessionToken = () => {
  return "sess_" + crypto.randomBytes(32).toString("hex");
};

/**
 * Generate a random email verification token
 * @returns {string} Email verification token
 */
const generateEmailVerificationToken = () => {
  return crypto.randomBytes(32).toString("hex");
};

/**
 * Generate a random password reset token
 * @returns {string} Password reset token
 */
const generatePasswordResetToken = () => {
  return crypto.randomBytes(32).toString("hex");
};

/**
 * Generate session expiry date
 * @param {number} days - Number of days from now (default: 7)
 * @returns {Date} Expiry date
 */
const generateSessionExpiry = (days = SESSION_EXPIRY_DAYS) => {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
};

/**
 * Generate email verification expiry date
 * @param {number} hours - Number of hours from now (default: 24)
 * @returns {Date} Expiry date
 */
const generateEmailVerificationExpiry = (
  hours = EMAIL_VERIFICATION_EXPIRY_HOURS
) => {
  return new Date(Date.now() + hours * 60 * 60 * 1000);
};

/**
 * Generate password reset expiry date
 * @param {number} hours - Number of hours from now (default: 1)
 * @returns {Date} Expiry date
 */
const generatePasswordResetExpiry = (hours = PASSWORD_RESET_EXPIRY_HOURS) => {
  return new Date(Date.now() + hours * 60 * 60 * 1000);
};

module.exports = {
  generateSessionToken,
  generateEmailVerificationToken,
  generatePasswordResetToken,
  generateSessionExpiry,
  generateEmailVerificationExpiry,
  generatePasswordResetExpiry,
};
