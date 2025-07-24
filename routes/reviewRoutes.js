const express = require("express");
const {authMiddleware,roleMiddleware} = require("../middlewares/auth");
const {
  addReview,
  getAllReviews,
  getReviewsByProduct,
  deleteReview,
} = require("../controllers/reviewController");

const router = express.Router();

router.post("/addReview",authMiddleware, addReview); // Add new review
router.get("/getAllReviews",authMiddleware, getAllReviews); // Get all reviews
router.get("/getReviewsByProduct/:productId",authMiddleware, getReviewsByProduct); // GET /api/reviews/665f0ab12f1a5e2c3e6b9e22?page=2&limit=3
router.delete("/deleteReview/:productId/:customerId",authMiddleware, deleteReview); // Delete specific review (by index)

module.exports = router;

