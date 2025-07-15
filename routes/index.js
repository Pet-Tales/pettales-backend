const express = require("express");
const authRoutes = require("./auth");
const userRoutes = require("./user");
const characterRoutes = require("./character");
const webhookRoutes = require("./webhook");
const bookRoutes = require("./book");
const pageRoutes = require("./page");
const galleryRoutes = require("./gallery");
const illustrationRoutes = require("./illustrationRoutes");
const creditRoutes = require("./credit");

const router = express.Router();

// Mount auth routes
router.use("/auth", authRoutes);

// Mount user routes
router.use("/user", userRoutes);

// Mount character routes
router.use("/characters", characterRoutes);

// Mount book routes
router.use("/books", bookRoutes);

// Mount page routes
router.use("/pages", pageRoutes);

// Mount gallery routes (public, no auth required)
router.use("/gallery", galleryRoutes);

// Mount illustration routes
router.use("/illustrations", illustrationRoutes);

// Mount credit routes
router.use("/credits", creditRoutes);

// Mount webhook routes
router.use("/webhook", webhookRoutes);

module.exports = router;
