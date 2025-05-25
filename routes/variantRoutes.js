const express = require("express");
const router = express.Router();
const fileUpload = require("express-fileupload");
const {
  createVariant,
  getAllVariants,
  getVariantById,
  updateVariant,
  deleteVariant,
} = require("../controllers/variantController");

// Middleware to handle file upload
router.use(fileUpload({ useTempFiles: true }));

// CRUD routes
router.post("/createVariant", createVariant);
router.get("/getAllVariants", getAllVariants);
router.get("/getVariantById/:id", getVariantById);
router.patch("/updateVariant/:id", updateVariant);
router.delete("/deleteVariant/:id", deleteVariant);

module.exports = router;
