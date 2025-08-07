const emailVerification = require("./emailVerification");
const welcome = require("./welcome");
const passwordReset = require("./passwordReset");
const passwordChangeConfirmation = require("./passwordChangeConfirmation");
const emailChangeVerification = require("./emailChangeVerification");
const bookGenerationSuccess = require("./bookGenerationSuccess");
const bookGenerationFailure = require("./bookGenerationFailure");
const contactForm = require("./contactForm");
const printOrderShipped = require("./printOrderShipped");
const printOrderRejected = require("./printOrderRejected");
const printOrderCanceled = require("./printOrderCanceled");
const printOrderInProduction = require("./printOrderInProduction");
const printOrderStatusUpdate = require("./printOrderStatusUpdate");

module.exports = {
  emailVerification,
  welcome,
  passwordReset,
  passwordChangeConfirmation,
  emailChangeVerification,
  bookGenerationSuccess,
  bookGenerationFailure,
  contactForm,
  printOrderShipped,
  printOrderRejected,
  printOrderCanceled,
  printOrderInProduction,
  printOrderStatusUpdate,
};
