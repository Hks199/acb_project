const mongoose = require("mongoose");

const variantCombinationSchema = new mongoose.Schema({
  _id: {
    type: mongoose.Schema.Types.ObjectId,
    default: () => new mongoose.Types.ObjectId(), // Auto-generate _id
  },
  Size: {
    type: String,
    required: true,
    trim: true
  },
  Color: {
    type: String,
    required: true,
    trim: true
  },
  price: {
    type: Number,
    required: true,
    min: 0
  },
  stock: {
    type: Number,
    required: true,
    min: 0
  }
});

// Define color_images schema as array of key-value objects
const colorImageSchema = new mongoose.Schema(
  {},
  { strict: false, _id: false }
);

const variantModelSchema = new mongoose.Schema({
  productId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Product",
    required: true
  },
  varient_name: {
    type: String,
    required: true,
    trim: true
  },
  Size: {
    type: [String],
    required: true
  },
  Color: {
    type: [String],
    required: true
  },
  combinations: {
    type: [variantCombinationSchema],
    required: true,
    validate: {
      validator: arr => arr.length > 0,
      message: "At least one variant combination is required"
    }
  },
  color_images: {
    type: [colorImageSchema],
    default: [],
    validate: {
      validator: function (arr) {
        return arr.every(obj =>
          typeof obj === "object" &&
          Object.values(obj).every(
            urls => Array.isArray(urls) && urls.every(url => typeof url === "string")
          )
        );
      },
      message: "Each color image set must be an object with color as key and array of string URLs as value"
    }
  }
}, { timestamps: true });

module.exports = mongoose.model("ProductVariantSet", variantModelSchema);
