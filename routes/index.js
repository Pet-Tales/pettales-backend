const express = require("express");
const authRoutes = require("./auth");
const userRoutes = require("./user");
const characterRoutes = require("./character");

const router = express.Router();

// Mount auth routes
router.use("/auth", authRoutes);

// Mount user routes
router.use("/user", userRoutes);

// Mount character routes
router.use("/characters", characterRoutes);

module.exports = router;
