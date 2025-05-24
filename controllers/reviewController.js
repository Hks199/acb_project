const ProductReview = require("../models/ratingAndreviewModel");
const { CustomError } = require("../errors/CustomErrorHandler.js");

// CREATE or ADD REVIEW for a Product
const addReview = async (req, res, next) => {
    try {
      const { productId, customerId, rating, review } = req.body;
  
      let productReview = await ProductReview.findOne({ productId });
  
      if (!productReview) {
        // No existing review doc for the product, create one
        productReview = await ProductReview.create({
          productId,
          review_and_rating: [{ customerId, rating, review }],
        });
      } else {
        // Check if customer already reviewed
        const alreadyReviewed = productReview.review_and_rating.some(
          (entry) => entry.customerId.toString() === customerId
        );
  
        if (alreadyReviewed) {
          return next(
            new CustomError("DuplicateReview", "You have already reviewed this product.", 400)
          );
        }
  
        // Add new review
        productReview.review_and_rating.push({ customerId, rating, review });
        await productReview.save();
      }
  
      res.status(201).json({ success: true, Message : "Review Submited Successfully" });
    } catch (error) {
      next(new CustomError("AddReviewError", error.message, 400));
    }
  };
  

// GET all reviews for all products  (Not In Use)
const getAllReviews = async (req, res, next) => {
  try {
    const reviews = await ProductReview.find()
      .populate("productId", "product_name")
      .populate("review_and_rating.customerId", "first_name last_name");

    res.status(200).json({ success: true, reviews });
  } catch (error) {
    next(new CustomError("FetchAllReviewsError", error.message, 500));
  }
};

// GET all reviews for a specific product
const getReviewsByProduct = async (req, res, next) => {
    try {
      const { productId } = req.params;
      const { page = 1, limit = 5 } = req.query;
  
      const reviewData = await ProductReview.findOne({ productId })
        .populate("productId", "product_name")
        .populate("review_and_rating.customerId", "first_name last_name");
  
      if (!reviewData) {
        return next(new CustomError("NotFound", "No reviews found for this product", 404));
      }
  
      // Manual pagination on nested array
      const pageInt = parseInt(page);
      const limitInt = parseInt(limit);
      const startIndex = (pageInt - 1) * limitInt;
      const endIndex = startIndex + limitInt;
  
      const totalReviews = reviewData.review_and_rating.length;
      const paginatedReviews = reviewData.review_and_rating.slice(startIndex, endIndex);
  
      res.status(200).json({
        success: true,
        totalReviews,
        currentPage: pageInt,
        totalPages: Math.ceil(totalReviews / limitInt),
        reviews: paginatedReviews,
      });
    } catch (error) {
      next(new CustomError("FetchProductReviewError", error.message, 500));
    }
  };
  

// DELETE a specific review
const deleteReview = async (req, res, next) => {
  try {
    const { productId, customerId } = req.params;

    const productReview = await ProductReview.findOne({ productId });

    if (!productReview) {
      return next(new CustomError("NotFound", "Product review not found", 404));
    }

    const updatedReviews = productReview.review_and_rating.filter(
        (rev) => rev.customerId.toString() !== customerId
    );

    productReview.review_and_rating = updatedReviews;
    await productReview.save();

    res.status(200).json({ success: true, message: "Review deleted successfully" });
  } catch (error) {
    next(new CustomError("DeleteReviewError", error.message, 500));
  }
};


module.exports = {
    addReview,
    getAllReviews,
    getReviewsByProduct,
    deleteReview,
  };