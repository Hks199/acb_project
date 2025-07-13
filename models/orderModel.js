const mongoose = require("mongoose");

const orderSchema = new mongoose.Schema(
  {
    order_number : {
      type : String,
      unique:true,
      required : true
    },
    user_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    orderedItems: [
      {
        product_id: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Product",
          required: true,
        },
        variant_combination_id: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "ProductVariantSet", // Optional, if variants exist
        },
        // vendor_id: {
        //   type: mongoose.Schema.Types.ObjectId,
        //   ref: "Vendor",
        //   required: true,
        // },
        quantity: {
          type: Number,
          required: true,
          min: 1,
        },
        price_per_unit: {
          type: Number,
          required: true,
        },
        total_price: {
          type: Number,
          required: true,
        },
      },
    ],

    shippingAddress: {
      fullName: { type: String, required: true },
      mobile: { type: String, required: true },
      addressLine1: { type: String, required: true },
      addressLine2: { type: String },
      city: { type: String, required: true },
      state: { type: String, required: true },
      postalCode: { type: String, required: true },
      country: { type: String, required: true },
    },

    paymentMethod: {
      type: String,
      enum: ["COD", "UPI", "Card", "NetBanking", "Wallet"],
      required: true,
    },

    paymentStatus: {
      type: String,
      enum: ["Pending", "Paid", "Failed", "Refunded"],
      default: "Pending",
    },

    orderStatus: {
      type: String,
      enum: ["Pending", "Confirmed", "Shipped", "Delivered"],
      default: "Pending",
    },

    subtotal: {
      type: Number,
      required: true,
    },

    tax: {
      type: Number,
      default: 0,
    },

    deliveryCharge: {
      type: Number,
      default: 0,
    },

    totalAmount: {
      type: Number,
      required: true,
    },
    razorpayOrderId: {
      type: String,
      // unique: true,
    },
    currency: {
      type: String,
      default: "INR"
    },
    razorpayPaymentId: {
      type : String,
      // unique : true
    }, 
    shippedAt: {
      type: Date,
    },
    deliveredAt: {
      type: Date,
    },
    isDeleted: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);


module.exports = mongoose.model("Order", orderSchema);
