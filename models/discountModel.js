const mongoose = require("mongoose");

const discountSchema = new mongoose.Schema(
  {
    first_time_discount_in_percentage : {
        type : Number,
        default : 0
    },

    additional_discount_in_percentage : {
        type : Number,
        default : 0
    },
    additional_discount_minimum_amount : {
        type : Number,
        default : 0
    }
  },
  { timestamps: true }
);


module.exports = mongoose.model("Discount", discountSchema);
