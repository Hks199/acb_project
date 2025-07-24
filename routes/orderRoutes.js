const express = require("express");
const router = express.Router();
const {authMiddleware,roleMiddleware} = require("../middlewares/auth");
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

router.post("/create",authMiddleware, createOrder);
router.post("/verify",authMiddleware, verifyPayment);
router.post('/getUserOrderedProducts',authMiddleware,getUserOrderedProducts);
router.post('/listAllOrders',authMiddleware,listAllOrders);
router.post('/getOrderDetails',authMiddleware,getOrderDetails);
router.post('/generateOrderBill',authMiddleware,generateOrderBill);

// Customer: cancel/return
// router.patch("/orders/:orderId/customer-action", handleCustomerOrderAction);

// Admin: shipped/delivered/refunded
router.patch("/handle-admin-action", handleAdminOrderAction);
router.patch("/cancelOrReturnOrderItem",cancelOrReturnOrderItem);

module.exports = router;