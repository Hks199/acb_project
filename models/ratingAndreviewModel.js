const mongoose = require("mongoose");

const reviewSchema = new mongoose.Schema(
  {
    customerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "userModel",
      required: true,
    },
    rating: {
      type: Number,
      required: true,
      min: 1,
      max: 5,
    },
    review: {
      type: String,
      trim: true,
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false } // optional: prevents MongoDB from generating a unique _id for each subdocument
);

const productReviewSchema = new mongoose.Schema(
  {
    vendorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "userModel",
      required: true,
    },
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },
    review_and_rating: {
      type: [reviewSchema],
      default: [],
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("ProductReview", productReviewSchema);
