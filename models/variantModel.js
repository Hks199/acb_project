const mongoose = require("mongoose");

const variantCombinationSchema = new mongoose.Schema({
  _id: {
    type: mongoose.Schema.Types.ObjectId,
    default: () => new mongoose.Types.ObjectId(), // Automatically generate _id
  },
  varient_name : {
    type : String,
    required : true,
    trim : true
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

const variantModelSchema = new mongoose.Schema({
  productId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Product",
    required: true
  },
  Size: {
    type: [String], // All available sizes
    required: true
  },
  Color: {
    type: [String], // All available colors
    required: true
  },
  combinations: {
    type: [variantCombinationSchema],
    required: true,
    validate: {
      validator: arr => arr.length > 0,
      message: "At least one variant combination is required"
    }
  }
}, { timestamps: true });

module.exports = mongoose.model("ProductVariantSet", variantModelSchema);


// const variantSchema = new mongoose.Schema(
//   {
//     product_id: {
//       type: mongoose.Schema.Types.ObjectId,
//       ref: "Product",
//       required: true,
//     },

//     // variant_attributes: {
//     //   type: Map,
//     //   of: String,
//     //   required: true,
//     //   // Example: { size: "M", color: "Red" }
//     // },
//     size : {
//       type : String,
//       required : true
//     },
//     color : {
//        type : String,
//        required : true
//     },
//     price: {
//       type: Number,
//       required: true,
//     },

//     stock: {
//       type: Number,
//       default: 0,
//     },

//     imageUrls: {
//       type: [String],
//       validate: {
//         validator: function (arr) {
//           return arr.every(url => typeof url === "string");
//         },
//         message: "All image URLs must be strings.",
//       },
//     },
//     imageKeys: {
//       type: [String], // S3 object keys for deletion
//       required: true,
//       validate: {
//         validator: arr => arr.every(key => typeof key === "string"),
//         message: "All image keys must be strings.",
//       },
//     },
//     isActive: {
//       type: Boolean,
//       default: true,
//     },
//   },
//   { timestamps: true }
// );





// module.exports = mongoose.model("Variant", variantSchema);
