const mongoose = require("mongoose");

const productSchema = new mongoose.Schema(
  {
    category_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
      required: true,
    },

    vendor_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    product_name: {
      type: String,
      required: true,
      trim: true,
    },

    description: {
      type: mongoose.Schema.Types.Mixed,
      required: true,
    },

    price: {
      type: Number,
      required: true,
      min: 0,
    },

    stock: {
      type: Number,
      default: 0,
      min: 0,
    },

    imageUrls: {
      type: [String], // Public URLs for rendering images
      validate: {
        validator: arr => arr.every(url => typeof url === "string"),
        message: "All image URLs must be strings.",
      },
    },

    imageKeys: {
      type: [String], // S3 object keys for deletion
      required: true,
      validate: {
        validator: arr => arr.every(key => typeof key === "string"),
        message: "All image keys must be strings.",
      },
    },

    isActive: {
      type: Boolean,
      default: true,
    },

    avg_rating: {
      type: Number,
      default: 0,
      min: 0,
      max: 5,
    },

    review_count: {
      type: Number,
      default: 0,
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model("Product", productSchema);
