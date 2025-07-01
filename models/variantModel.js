
const mongoose = require("mongoose");

// Sub-schema for variant combinations
const variantCombinationSchema = new mongoose.Schema({
  _id: {
    type: mongoose.Schema.Types.ObjectId,
    default: () => new mongoose.Types.ObjectId(), // Auto-generate _id
  },
  Size: {
    type: String,
    required: true,
    trim: true,
  },
  Color: {
    type: String,
    required: true,
    trim: true,
  },
  price: {
    type: Number,
    required: true,
    min: 0,
  },
  stock: {
    type: Number,
    required: true,
    min: 0,
  }
});

// Main schema
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
  color_images: [
    {
      color: String,
      images: [String]
    }
  ]
  
}, { timestamps: true });

module.exports = mongoose.model("ProductVariantSet", variantModelSchema);
