const express = require("express");
const {
        markCancelledOrderAsProcessed,
        updateRefundStatus
 } = require("../controllers/cancelOrderController");
const router = express.Router();


router.patch("/cancelled-orders/:id/process", markCancelledOrderAsProcessed);

router.patch("/cancelled-orders/:id/refund-status",updateRefundStatus);

module.exports = router;
