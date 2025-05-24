
const express = require("express");
const router = express.Router();
const {
    markAsInspected,
    updateReturnStatus

} = require("../controllers/returnOrderController");

router.patch("/return/:id/inspect", markAsInspected);
router.patch("/return/:id/status", updateReturnStatus);
module.exports = router;
