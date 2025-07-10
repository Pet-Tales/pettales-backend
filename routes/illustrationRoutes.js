const express = require("express");
const router = express.Router();
const {
  regenerateFrontCover,
  regenerateBackCover,
  regeneratePageIllustration,
} = require("../controllers/illustrationController");
const { requireAuth } = require("../middleware");

/**
 * @route POST /api/illustrations/regenerate/front-cover/:bookId
 * @desc Regenerate front cover illustration
 * @access Private (Book Owner)
 */
router.post(
  "/regenerate/front-cover/:bookId",
  requireAuth,
  regenerateFrontCover
);

/**
 * @route POST /api/illustrations/regenerate/back-cover/:bookId
 * @desc Regenerate back cover illustration
 * @access Private (Book Owner)
 */
router.post("/regenerate/back-cover/:bookId", requireAuth, regenerateBackCover);

/**
 * @route POST /api/illustrations/regenerate/page/:pageId
 * @desc Regenerate page illustration
 * @access Private (Book Owner)
 */
router.post(
  "/regenerate/page/:pageId",
  requireAuth,
  regeneratePageIllustration
);

module.exports = router;
