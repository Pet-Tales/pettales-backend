const express = require("express");
const authRoutes = require("./auth");
const userRoutes = require("./user");
const characterRoutes = require("./character");
const webhookRoutes = require("./webhook");
const bookRoutes = require("./book");
const webhookManagementRoutes = require("./webhookManagement");
const pageRoutes = require("./page");
const galleryRoutes = require("./gallery");
const illustrationRoutes = require("./illustrationRoutes");
// REMOVED: const creditRoutes = require("./credit");
const contactRoutes = require("./contact");
const printOrderRoutes = require("./printOrder");
const charityRoutes = require("./charity");

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

// REMOVED: Mount credit routes
// router.use("/credits", creditRoutes);

// Mount contact routes (public, no auth required)
router.use("/contact", contactRoutes);

// Mount print order routes
router.use("/print-orders", printOrderRoutes);

// Mount webhook routes
router.use("/webhook", webhookRoutes);

// Admin webhook management routes
router.use("/admin/webhooks", webhookManagementRoutes);

// Charity routes (public + admin)
router.use("/charities", charityRoutes);

module.exports = router;
