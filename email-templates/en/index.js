const emailVerification = require("./emailVerification");
const welcome = require("./welcome");
const passwordReset = require("./passwordReset");
const passwordChangeConfirmation = require("./passwordChangeConfirmation");
const emailChangeVerification = require("./emailChangeVerification");
const bookGenerationSuccess = require("./bookGenerationSuccess");
const bookGenerationFailure = require("./bookGenerationFailure");
const contactForm = require("./contactForm");

module.exports = {
  emailVerification,
  welcome,
  passwordReset,
  passwordChangeConfirmation,
  emailChangeVerification,
  bookGenerationSuccess,
  bookGenerationFailure,
  contactForm,
};
