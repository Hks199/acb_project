const mongoose = require("mongoose");

const returnedOrderSchema = new mongoose.Schema(
  {
    orderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
      required: true,
    },
    user_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    product_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },
    variant_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Variant",
    },
    quantity: {
      type: Number,
      required: true,
    },
    price_per_unit: {
      type: Number,
      required: true,
    },
    total_price: {
      type: Number,
      required: true,
    },
    returnReason: {
      type: String,
      trim: true,
    },
    returnedAt: {
      type: Date,
      default: Date.now,
    },
    refundStatus: {
      type: String,
      enum: ["Pending", "Processed", "NotRequired"],
      default: "Pending",
    },
    transaction_id: {
      type: String,
      unique: true,
      sparse: true,
    },
    isInspected: {
      type: Boolean,
      default: false,
    },
    returnImages: [
      {
        type: String, // Image URLs or paths
        required: true,
      }
    ],
  },
  { timestamps: true }
);

module.exports = mongoose.model("ReturnedOrder", returnedOrderSchema);
