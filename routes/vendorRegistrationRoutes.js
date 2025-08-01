const express = require("express");
const router = express.Router();
const {authMiddleware,roleMiddleware} = require("../middlewares/auth");
const {
    createVendor,
    getAllVendors,
    getVendorById,
    updateVendor,
    deleteVendor,
    getVendorWiseProducts
} = require("../controllers/vendorRegistrationController");

router.post("/create-vendor", createVendor);
router.post("/getAll-vendor", getAllVendors);
router.get("/getVendor-byId/:id", getVendorById);
router.patch("/update-vendor/:id", updateVendor);
router.delete("/delete-vendor/:id", deleteVendor);
router.post('/getVendorWiseProducts',getVendorWiseProducts);

module.exports = router;
