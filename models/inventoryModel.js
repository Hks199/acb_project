const mongoose = require("mongoose");

const productSchema = new mongoose.Schema(
  {
    category_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category", // assuming you have a Category model
      required: true,
    },

    vendor_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User", // assuming you have a Vendor model
      required: true,
    },

    product_name: {
      type: String,
      required: true,
      trim: true,
    },

    description: {
      type: mongoose.Schema.Types.Mixed, // Accepts dynamic key-value pairs
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
      type: [String], // Array of image URLs
      validate: {
        validator: function (arr) {
          return arr.every(url => typeof url === "string");
        },
        message: "All image URLs must be strings.",
      },
    },

    isActive: {
      type: Boolean,
      default: true,
    },
    avg_rating : {
      type : Number,
      default : 0,
      max : 0,
      min : 0
    },
    review_count : {
      type : Number,
      default : 0
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model("Product", productSchema);
