const ProductReview = require("../models/ratingAndreviewModel");

// Derive listing ratings from saved customer reviews, not cached product fields.
const withProductRatings = async (products) => {
  if (products.length === 0) return [];

  const summaries = await ProductReview.aggregate([
    { $match: { productId: { $in: products.map((product) => product._id) } } },
    { $unwind: "$review_and_rating" },
    { $group: {
      _id: "$productId",
      averageRating: { $avg: "$review_and_rating.rating" },
      totalRatings: { $sum: 1 },
    } },
  ]);
  const byProduct = new Map(summaries.map((summary) => [summary._id.toString(), summary]));

  return products.map((product) => {
    const summary = byProduct.get(product._id.toString());
    return {
      ...(typeof product.toObject === "function" ? product.toObject() : product),
      avg_rating: summary ? Number(summary.averageRating.toFixed(1)) : 0,
      review_count: summary?.totalRatings || 0,
    };
  });
};

module.exports = { withProductRatings };
