const express = require("express");
const router = express.Router();
const {authMiddleware,roleMiddleware} = require("../middlewares/auth");
const {
        markCancelledOrderAsProcessed,
        updateRefundStatus,
        getUserCancelledItems,
 } = require("../controllers/cancelOrderController");


router.patch("/cancelled-orders/:id/process", markCancelledOrderAsProcessed);

router.patch("/cancelled-orders-status-update",updateRefundStatus);

router.post("/user-cancel-order",getUserCancelledItems)

module.exports = router;
