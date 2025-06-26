const express = require("express");
const router = express.Router();
const fileUpload = require("express-fileupload");
const {
  createVariant,
  getAllVariantsByProduct_id,
  getVariantById,
  updateVariant,
  deleteVariant,
} = require("../controllers/variantController");

// Middleware to handle file upload
router.use(fileUpload({ useTempFiles: true }));

// CRUD routes
router.post("/createVariant", createVariant);
router.get("/getAllVariants/:id", getAllVariantsByProduct_id);
router.get("/getVariantById/:id", getVariantById);
router.patch("/updateVariant/:id", updateVariant);
router.delete("/deleteVariant/:id", deleteVariant);

module.exports = router;
