const emailVerification = require("./emailVerification");
const welcome = require("./welcome");
const passwordReset = require("./passwordReset");
const passwordChangeConfirmation = require("./passwordChangeConfirmation");
const emailChangeVerification = require("./emailChangeVerification");

module.exports = {
  emailVerification,
  welcome,
  passwordReset,
  passwordChangeConfirmation,
  emailChangeVerification,
};
