const express = require("express");
const {
  addReview,
  getAllReviews,
  getReviewsByProduct,
  deleteReview,
} = require("../controllers/reviewController");

const router = express.Router();

router.post("/addReview", addReview); // Add new review
router.get("/getAllReviews", getAllReviews); // Get all reviews
router.get("/getReviewsByProduct/:productId", getReviewsByProduct); // GET /api/reviews/665f0ab12f1a5e2c3e6b9e22?page=2&limit=3
router.delete("/:productId/:reviewId", deleteReview); // Delete specific review (by index)

module.exports = router;

