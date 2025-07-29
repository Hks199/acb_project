const express = require("express");
const router = express.Router();
const {authMiddleware,roleMiddleware} = require("../middlewares/auth");
const {
        markCancelledOrderAsProcessed,
        updateRefundStatus,
        getUserCancelledItems,
        getCanceledItemDetails
 } = require("../controllers/cancelOrderController");


router.patch("/cancelled-orders/:id/process", markCancelledOrderAsProcessed);

router.patch("/cancelled-orders-status-update",updateRefundStatus);

router.post("/user-cancel-order",getUserCancelledItems);

router.post('/cancel-order-details',getCanceledItemDetails);

module.exports = router;
