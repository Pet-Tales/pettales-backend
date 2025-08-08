const express = require("express");
const router = express.Router();
const charityController = require("../controllers/charityController");
const { requireAuth, requireAdmin } = require("../middleware/auth");

// Public: list enabled charities for donation selection
router.get("/", charityController.listEnabled);

// Admin: CRUD
router.get("/admin", requireAuth, requireAdmin, charityController.listAll);
router.post("/admin", requireAuth, requireAdmin, charityController.create);
router.put("/admin/:id", requireAuth, requireAdmin, charityController.update);
router.delete("/admin/:id", requireAuth, requireAdmin, charityController.remove);
router.patch("/admin/:id/toggle", requireAuth, requireAdmin, charityController.toggleEnable);

module.exports = router;

