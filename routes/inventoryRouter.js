const express = require("express");
const router = express.Router();
const fileUpload = require("express-fileupload");
const {
  createProduct,
  getAllProducts,
  getProductById,
  updateProduct,
  deleteProduct,
  getProductsSortedByReviews,
  searchProductsByName,
  getProductsByCategoryId
  
} = require("../controllers/inventroryController");

// Middleware to handle file upload
router.use(fileUpload());

router.post("/createProduct", createProduct);
router.get("/getAllProducts", getAllProducts); 
router.get("/getProductById/:id", getProductById);
router.patch("/updateProduct/:id", updateProduct);
router.delete("/deleteProduct/:id", deleteProduct);
router.post("/getProduct-sortedbyReview",getProductsSortedByReviews)
router.post("/searchProductsByName",searchProductsByName);
router.post("/getProductsByCategoryId",getProductsByCategoryId)

module.exports = router;
