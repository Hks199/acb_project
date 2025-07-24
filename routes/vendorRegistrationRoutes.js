const express = require("express");
const router = express.Router();
const {authMiddleware,roleMiddleware} = require("../middlewares/auth");
const {
    createVendor,
    getAllVendors,
    getVendorById,
    updateVendor,
    deleteVendor
} = require("../controllers/vendorRegistrationController");

router.post("/create-vendor",authMiddleware, createVendor);
router.post("/getAll-vendor",authMiddleware, getAllVendors);
router.get("/getVendor-byId/:id",authMiddleware, getVendorById);
router.patch("/update-vendor/:id",authMiddleware, updateVendor);
router.delete("/delete-vendor/:id",authMiddleware, deleteVendor);

module.exports = router;
