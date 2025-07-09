
const express = require("express");
const router = express.Router();
const {
    markAsInspected,
    updateReturnStatus,
    getUserReturnedItems
    

} = require("../controllers/returnOrderController");

router.patch("/return/:id/inspect", markAsInspected);
router.patch("/return/:id/status", updateReturnStatus);
router.post("/user-return-item",getUserReturnedItems);
module.exports = router;
