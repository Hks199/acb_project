const express = require("express");
const router = express.Router();
const {authMiddleware,roleMiddleware} = require("../middlewares/auth");
const {
        markCancelledOrderAsProcessed,
        updateRefundStatus,
        getUserCancelledItems,
 } = require("../controllers/cancelOrderController");


router.patch("/cancelled-orders/:id/process",authMiddleware, markCancelledOrderAsProcessed);

router.patch("/cancelled-orders-status-update",authMiddleware,updateRefundStatus);

router.post("/user-cancel-order",authMiddleware,getUserCancelledItems)

module.exports = router;
