const express = require("express");
const router = express.Router();
const printOrderController = require("../controllers/printOrderController");
const { requireAuth } = require("../middleware");
const {
  calculateCostValidation,
  createPrintOrderValidation,
  getPrintOrdersValidation,
  printOrderIdValidation,
  shippingOptionsValidation,
} = require("../middleware/printOrderValidation");

/**
 * @route POST /api/print-orders/calculate-cost
 * @desc Calculate print order cost
 * @access Private
 */
router.post(
  "/calculate-cost",
  requireAuth,
  calculateCostValidation,
  printOrderController.calculateCost
);

/**
 * @route POST /api/print-orders/create-checkout
 * @desc Create a Stripe checkout session for print order
 * @access Private
 */
router.post(
  "/create-checkout",
  requireAuth,
  createPrintOrderValidation,
  printOrderController.createPrintOrderCheckout
);

/**
 * @route POST /api/print-orders/create
 * @desc DEPRECATED - Create a new print order (now redirects to checkout)
 * @access Private
 */
router.post(
  "/create",
  requireAuth,
  createPrintOrderValidation,
  printOrderController.createPrintOrder
);

/**
 * @route GET /api/print-orders/
 * @desc Get user's print orders
 * @access Private
 */
router.get(
  "/",
  requireAuth,
  getPrintOrdersValidation,
  printOrderController.getUserPrintOrders
);

/**
 * @route GET /api/print-orders/:orderId
 * @desc Get specific print order
 * @access Private
 */
router.get(
  "/:orderId",
  requireAuth,
  printOrderIdValidation,
  printOrderController.getPrintOrder
);

/**
 * @route DELETE /api/print-orders/:orderId
 * @desc Cancel a print order
 * @access Private
 */
router.delete(
  "/:orderId",
  requireAuth,
  printOrderIdValidation,
  printOrderController.cancelPrintOrder
);

/**
 * @route GET /api/print-orders/:orderId/status
 * @desc Get print order status from Lulu
 * @access Private
 */
router.get(
  "/:orderId/status",
  requireAuth,
  printOrderIdValidation,
  printOrderController.getPrintOrderStatus
);

/**
 * @route POST /api/print-orders/shipping-options
 * @desc Get available shipping options for a location
 * @access Private
 */
router.post(
  "/shipping-options",
  requireAuth,
  shippingOptionsValidation,
  printOrderController.getShippingOptions
);

module.exports = router;
