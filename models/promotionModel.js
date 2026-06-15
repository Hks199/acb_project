const mongoose = require("mongoose");

const promotionSchema = new mongoose.Schema(
  {
    product_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },

    min_quantity: {
      type: Number,
      required: true,
      min: 1,
    },

    promo_price: {
      type: Number,
      required: true,
      min: 0,
    },

    description: {
      type: String,
      trim: true,
      // e.g. "Buy 3 for ₹999"
    },

    is_active: {
      type: Boolean,
      default: true,
    },

    start_date: {
      type: Date,
      default: null,
    },

    end_date: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

// Index for fast product-based lookups
promotionSchema.index({ product_id: 1, is_active: 1 });

module.exports = mongoose.model("Promotion", promotionSchema);
