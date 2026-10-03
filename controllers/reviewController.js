const ProductReview = require("../models/ratingAndreviewModel");
const Product = require("../models/inventoryModel");
const mongoose = require("mongoose");
const { CustomError } = require("../errors/CustomErrorHandler.js");
const {updateRatingAndReview} = require("./inventroryController.js")

const isValidId = (value) => typeof value === "string" && mongoose.isObjectIdOrHexString(value);

// Keep the customerId.first_name response used by existing clients, without
// creating a login account for an admin-entered customer name.
const serializeReview = (entry) => {
  const review = typeof entry.toObject === "function" ? entry.toObject() : { ...entry };
  if (review.isAdminReview) {
    review.customerId = { _id: review.adminReviewId, first_name: review.customerName };
  }
  return review;
};

const addAdminReview = async (req, res, next) => {
  try {
    const { productId, customerName, rating, review } = req.body;
    if (!isValidId(productId)) {
      return next(new CustomError("BadRequest", "A valid productId is required", 400));
    }
    if (typeof customerName !== "string" || !customerName.trim() || customerName.trim().length > 100 ||
        !Number.isInteger(rating) || rating < 1 || rating > 5 ||
        typeof review !== "string" || !review.trim() || review.trim().length > 5000) {
      return next(new CustomError("BadRequest", "Provide a customer name (up to 100 characters), a rating from 1 to 5, and review text (up to 5000 characters)", 400));
    }
    if (!await Product.exists({ _id: productId })) {
      return next(new CustomError("NotFound", "Product not found", 404));
    }
    const entry = {
      adminReviewId: new mongoose.Types.ObjectId(),
      customerName: customerName.trim(),
      rating,
      review: review.trim(),
      isAdminReview: true,
    };
    let productReview = await ProductReview.findOne({ productId });
    if (!productReview) {
      productReview = await ProductReview.create({ productId, review_and_rating: [entry] });
    } else {
      productReview.review_and_rating.push(entry);
      await productReview.save();
    }
    await getAverageRating(productId);
    res.status(201).json({ success: true, productId, totalReviews: productReview.review_and_rating.length,
      message: "Admin review added successfully" });
  } catch (error) {
    next(error instanceof CustomError ? error : new CustomError("AddAdminReviewError", error.message, 400));
  }
};

// CREATE or ADD REVIEW for a Product
const addReview = async (req, res, next) => {
    try {
      const { productId, customerId, rating, review } = req.body;
      if (!isValidId(productId) || !isValidId(customerId)) {
        return next(new CustomError("BadRequest", "Valid productId and customerId are required", 400));
      }
      if (!Number.isFinite(rating) || rating < 1 || rating > 5 || (review != null && typeof review !== "string")) {
        return next(new CustomError("BadRequest", "A rating from 1 to 5 and valid review text are required", 400));
      }
      if (!await Product.exists({ _id: productId })) {
        return next(new CustomError("NotFound", "Product not found", 404));
      }
  
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
          (entry) => entry.customerId?.toString() === customerId.toLowerCase()
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
      await getAverageRating(productId);
      res.status(201).json({ success: true, productId, Message : "Review Submited Successfully" });
    } catch (error) {
      next(error instanceof CustomError ? error : new CustomError("AddReviewError", error.message, 400));
    }
  };
  

// GET all reviews for all products  (Not In Use)
const getAllReviews = async (req, res, next) => {
  try {
    const reviews = await ProductReview.find()
      .populate("productId", "product_name")
      .populate("review_and_rating.customerId", "first_name");

    const serializedReviews = reviews.map((document) => {
      const data = typeof document.toObject === "function" ? document.toObject() : { ...document };
      data.review_and_rating = document.review_and_rating.map(serializeReview);
      return data;
    });
    res.status(200).json({ success: true, reviews: serializedReviews });
  } catch (error) {
    next(new CustomError("FetchAllReviewsError", error.message, 500));
  }
};

// GET all reviews for a specific product

const getReviewsByProduct = async (req, res, next) => {
  try {
    const { productId } = req.params;
    if (!isValidId(productId)) {
      return next(new CustomError("BadRequest", "A valid productId is required", 400));
    }
    const { page = 1, limit = 5 } = req.body; // Use query for pagination
    const reviewData = await ProductReview.findOne({ productId })
      .populate("productId", "product_name")
      .populate("review_and_rating.customerId", "first_name");

    if (!reviewData || reviewData.review_and_rating.length === 0) {
      return next(new CustomError("NotFound", "No reviews found for this product", 404));
    }

    // Pagination logic
    const pageInt = parseInt(page);
    const limitInt = parseInt(limit);
    const totalReviews = reviewData.review_and_rating.length;

    const startIndex = (pageInt - 1) * limitInt;
    const endIndex = startIndex + limitInt;
    const paginatedReviews = reviewData.review_and_rating.slice(startIndex, endIndex);

    res.status(200).json({
      success: true,
      productId,
      totalReviews,
      currentPage: pageInt,
      totalPages: Math.ceil(totalReviews / limitInt),
      reviews: paginatedReviews.map(serializeReview),
    });

  } catch (error) {
    next(new CustomError("FetchProductReviewError", error.message, 500));
  }
};

  

// DELETE a specific review
const deleteReview = async (req, res, next) => {
  try {
    const { productId, customerId } = req.params;
    if (!isValidId(productId) || !isValidId(customerId)) {
      return next(new CustomError("BadRequest", "Valid productId and customerId are required", 400));
    }

    const productReview = await ProductReview.findOne({ productId });

    if (!productReview) {
      return next(new CustomError("NotFound", "Product review not found", 404));
    }

    if (productReview.review_and_rating.some((entry) => entry.isAdminReview &&
        entry.adminReviewId?.toString() === customerId.toLowerCase())) {
      return next(new CustomError("Forbidden", "Use the admin endpoint to delete an admin review", 403));
    }

    // Filter out the review by customerId
    const updatedReviews = productReview.review_and_rating.filter(
      rev => rev.customerId?.toString() !== customerId.toLowerCase()
    );

    // Check if any review was removed
    if (updatedReviews.length === productReview.review_and_rating.length) {
      return next(new CustomError("NotFound", "Review by this customer not found", 404));
    }

    productReview.review_and_rating = updatedReviews;
    await productReview.save();
    await getAverageRating(productId);

    res.status(200).json({
      success: true,
      message: "Review deleted successfully"
    });
  } catch (error) {
    next(new CustomError("DeleteReviewError", error.message, 500));
  }
};

async function getAverageRating(productId){
    const productReview = await ProductReview.findOne({ productId });

    if (!productReview || productReview.review_and_rating.length === 0) {
      await updateRatingAndReview(productId, 0, 0);
      return;
    }

    const totalRatings = productReview.review_and_rating.length;
    const sumOfRatings = productReview.review_and_rating.reduce(
      (acc, review) => acc + review.rating,
      0
    );

    const averageRating = Number((sumOfRatings / totalRatings).toFixed(1));
    await updateRatingAndReview(productId,averageRating,totalRatings);
};

const deleteAdminReview = async (req, res, next) => {
  try {
    const { productId, customerId } = req.params;
    if (!isValidId(productId) || !isValidId(customerId)) {
      return next(new CustomError("BadRequest", "Valid productId and customerId are required", 400));
    }
    const productReview = await ProductReview.findOne({ productId });
    if (!productReview) {
      return next(new CustomError("NotFound", "Product review not found", 404));
    }
    const remaining = productReview.review_and_rating.filter((entry) =>
      !(entry.isAdminReview && entry.adminReviewId?.toString() === customerId.toLowerCase()));
    if (remaining.length === productReview.review_and_rating.length) {
      return next(new CustomError("NotFound", "Admin review not found", 404));
    }
    productReview.review_and_rating = remaining;
    await productReview.save();
    await getAverageRating(productId);
    res.status(200).json({ success: true, message: "Admin review deleted successfully" });
  } catch (error) {
    next(error instanceof CustomError ? error : new CustomError("DeleteAdminReviewError", error.message, 500));
  }
};


module.exports = {
    addAdminReview,
    deleteAdminReview,
    addReview,
    getAllReviews,
    getReviewsByProduct,
    deleteReview,
  };
