const express = require("express");
const router = express.Router();
const {authMiddleware,roleMiddleware} = require("../middlewares/auth");
const {
  createVariantSet,
  getAllVariantSets,
  getVariantSetByProductId,
  updateVariantSet,
  deleteVariantSet,
  editVariantSetByProductId
} = require("../controllers/variantController");

// 🔹 Create variant set
router.post("/create-variant",authMiddleware, createVariantSet);

// 🔹 Get all variant sets
router.post("/getAllVariant",authMiddleware, getAllVariantSets);

// 🔹 Update variant set by ID
router.patch("/updateVariantSet/:id",authMiddleware, updateVariantSet);

// 🔹 Delete variant set by ID
router.delete("/deleteVariantSet/:id",authMiddleware, deleteVariantSet);

router.get("/edit-variant/:id",authMiddleware, editVariantSetByProductId)

module.exports = router;



// const express = require("express");
// const router = express.Router();
// const fileUpload = require("express-fileupload");
// const {
//   createVariant,
//   getAllVariantsByProduct_id,
//   getVariantById,
//   updateVariant,
//   deleteVariant,
// } = require("../controllers/variantController");

// // Middleware to handle file upload
// router.use(fileUpload({ useTempFiles: true }));

// // CRUD routes
// router.post("/createVariant", createVariant);
// router.get("/getAllVariants/:id", getAllVariantsByProduct_id);
// router.get("/getVariantById/:id", getVariantById);
// router.patch("/updateVariant/:id", updateVariant);
// router.delete("/deleteVariant/:id", deleteVariant);

// module.exports = router;
