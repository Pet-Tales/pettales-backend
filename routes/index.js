const express = require("express");
const authRoutes = require("./auth");
const userRoutes = require("./user");
const characterRoutes = require("./character");
const webhookRoutes = require("./webhook");

const router = express.Router();

// Mount auth routes
router.use("/auth", authRoutes);

// Mount user routes
router.use("/user", userRoutes);

// Mount character routes
router.use("/characters", characterRoutes);

// Mount webhook routes
router.use("/webhook", webhookRoutes);

module.exports = router;
