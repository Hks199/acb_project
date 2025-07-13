const mongoose = require("mongoose");

const productSchema = new mongoose.Schema(
  {
    productId: {
      type: String,
      unique: true,
    },
    category_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
      required: true,
    },
    seq: {
      type: Number,
      default: 0
    },
    vendor_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Vendor",
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


productSchema.pre("save", async function (next) {
  if (this.productId) return next(); // Skip if already set

  const lastProduct = await mongoose.model("Product").findOne().sort({ createdAt: -1 }).select("productId");

  let nextId = 1;
  if (lastProduct && lastProduct.productId) {
    const lastNum = parseInt(lastProduct.productId.split("-")[1]);
    if (!isNaN(lastNum)) {
      nextId = lastNum + 1;
    }
  }

  this.productId = `PROD-${String(nextId).padStart(4, "0")}`;
  next();
});


module.exports = mongoose.model("Product", productSchema);
