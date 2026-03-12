const express = require("express");
const router = express.Router();
const discountController = require("../controllers/discountController");

router.post("/discount", discountController.createDiscount);

router.get("/discount", discountController.getAllDiscounts);

router.get("/discount/:id", discountController.getDiscountById);

router.patch("/discount/:id", discountController.updateDiscount);

router.delete("/discount/:id", discountController.deleteDiscount);

module.exports = router;