const express = require("express");
const router = express.Router();
const { createOrder,
    verifyPayment,
    // handleCustomerOrderAction,
    handleAdminOrderAction,
    cancelOrReturnOrderItem,
    getUserOrderedProducts,
    listAllOrders,
    getOrderDetails,
    generateOrderBill
    
 } = require("../controllers/orderController");

router.post("/create", createOrder);
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