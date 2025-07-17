const emailService = require("./emailService");
const sessionCleanup = require("./sessionCleanup");
const s3Service = require("./s3Service");
const LambdaService = require("./lambdaService");
const BookService = require("./bookService");
const PageService = require("./pageService");
const GalleryService = require("./galleryService");

module.exports = {
  emailService,
  sessionCleanup,
  s3Service,
  LambdaService,
  BookService,
  PageService,
  GalleryService,
};
