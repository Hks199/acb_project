const mongoose = require("mongoose");

const variantSchema = new mongoose.Schema(
  {
    product_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },

    variant_attributes: {
      type: Map,
      of: String,
      required: true,
      // Example: { size: "M", color: "Red" }
    },

    price: {
      type: Number,
      required: true,
    },

    stock: {
      type: Number,
      default: 0,
    },

    imageUrls: {
      type: [String],
      validate: {
        validator: function (arr) {
          return arr.every(url => typeof url === "string");
        },
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
  },
  { timestamps: true }
);

module.exports = mongoose.model("Variant", variantSchema);
