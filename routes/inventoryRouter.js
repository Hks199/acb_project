const express = require("express");
const router = express.Router();
const fileUpload = require("express-fileupload");
const {authMiddleware,roleMiddleware} = require("../middlewares/auth");
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

router.post("/createProduct",authMiddleware, createProduct);
router.get("/getAllProducts",authMiddleware, getAllProducts); 
router.get("/getProductById/:id",authMiddleware, getProductById);
router.patch("/updateProduct/:id",authMiddleware, updateProduct);
router.delete("/deleteProduct/:id",authMiddleware, deleteProduct);
router.post("/getProduct-sortedbyReview",authMiddleware,getProductsSortedByReviews)
router.post("/searchProductsByName",authMiddleware,searchProductsByName);
router.post("/getProductsByCategoryId",authMiddleware,getProductsByCategoryId)

module.exports = router;
