
const express = require("express");
const router = express.Router();
const {authMiddleware,roleMiddleware} = require("../middlewares/auth");
const {
    markAsInspected,
    updateReturnStatus,
    getUserReturnedItems
    

} = require("../controllers/returnOrderController");

router.patch("/return/:id/inspect",authMiddleware, markAsInspected);
router.patch("/return-status",authMiddleware, updateReturnStatus);
router.post("/user-return-item",authMiddleware, getUserReturnedItems);
module.exports = router;
