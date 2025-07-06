// models/CancelledOrder.js
const mongoose = require("mongoose");

const cancelledOrderSchema = new mongoose.Schema(
  {
    orderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
      required: true,
      unique: true,
    },
    user_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    cancelledItems: [
      {
        product_id: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true },
        variant_combination_id: { type: mongoose.Schema.Types.ObjectId, ref: "Variant" },
        quantity: { type: Number, required: true },
        price_per_unit: { type: Number, required: true },
        total_price: { type: Number, required: true },
      }
    ],
    cancellationReason: {
      type: String,
      trim: true,
    },
    cancelledAt: {
      type: Date,
      default: Date.now,
    },
    refundStatus: {
      type: String,
      enum: ["Pending", "Processed", "NotRequired"],
      default: "Pending",
    },
    totalRefundAmount: {
        type: Number,
        required: true,
      },
    transaction_id : {
        type : String,
        // unique : true
    },
    isProcessed: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("CancelledOrder", cancelledOrderSchema);
