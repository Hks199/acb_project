const express = require("express");
const router = express.Router();
const {authMiddleware,roleMiddleware} = require("../middlewares/auth");
const { createOrder,
    getOrderQuote,
    verifyPayment,
    // handleCustomerOrderAction,
    handleAdminOrderAction,
    cancelOrReturnOrderItem,
    getUserOrderedProducts,
    listAllOrders,
    getOrderDetails,
    generateOrderBill
    
 } = require("../controllers/orderController");

router.post("/create", authMiddleware, createOrder);
// Guests can preview prices; only verified customers receive a first-order discount.
router.post("/quote", (req, res, next) => {
  if (req.headers?.authorization || req.cookies?.token) return authMiddleware(req, res, next);
  next();
}, getOrderQuote);
router.post("/verify", verifyPayment);
router.post('/getUserOrderedProducts',getUserOrderedProducts);
router.post('/listAllOrders',listAllOrders);
router.post('/getOrderDetails',getOrderDetails);
router.post('/generateOrderBill',generateOrderBill);

// Customer: cancel/return
// router.patch("/orders/:orderId/customer-action", handleCustomerOrderAction);

// Admin: shipped/delivered/refunded
router.patch("/handle-admin-action", handleAdminOrderAction);
router.patch("/cancelOrReturnOrderItem",cancelOrReturnOrderItem);

module.exports = router;
