const express = require("express");
const router = express.Router();
const { createOrder,
    verifyPayment,
    handleCustomerOrderAction,
    handleAdminOrderAction
 } = require("../controllers/orderController");

router.post("/create", createOrder);
router.post("/verify", verifyPayment);

// Customer: cancel/return
router.patch("/orders/:orderId/customer-action", handleCustomerOrderAction);

// Admin: shipped/delivered/refunded
router.patch("/orders/:orderId/admin-action", handleAdminOrderAction);

module.exports = router;