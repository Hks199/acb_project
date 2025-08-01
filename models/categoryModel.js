const mongoose = require("mongoose");

const categorySchema = new mongoose.Schema(
  {
    category: { type: String, required: true, trim: true, unique: true },
    imageUrls : {type : String, required: true, trim: true, unique: true}
  },
  { timestamps: true }
);

const Category = mongoose.model("Category", categorySchema);
module.exports = Category;