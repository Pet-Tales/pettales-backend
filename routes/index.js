const express = require("express");
const authRoutes = require("./auth");
const userRoutes = require("./user");

const router = express.Router();

// Mount auth routes
router.use("/auth", authRoutes);

// Mount user routes
router.use("/users", userRoutes);

module.exports = router;
