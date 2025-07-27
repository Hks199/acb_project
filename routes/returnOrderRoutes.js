
const express = require("express");
const router = express.Router();
const {authMiddleware,roleMiddleware} = require("../middlewares/auth");
const {
    markAsInspected,
    updateReturnStatus,
    getUserReturnedItems,
    getAllReturnedItems,
    getReturnedItemDetail
    

} = require("../controllers/returnOrderController");

router.patch("/return/:id/inspect", markAsInspected);
router.patch("/return-status", updateReturnStatus);
router.post("/user-return-item",getUserReturnedItems);
router.post("/getAllReturnedItems",getAllReturnedItems);
router.get("/getReturnedItemDetail/:returdId",getReturnedItemDetail);
module.exports = router;
