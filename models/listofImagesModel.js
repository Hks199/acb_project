// models/imageList.js
const mongoose = require("mongoose");

const listOfImages = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },
    imageUrls: {
      type: String,
      required: true,
      trim: true,
    },
    imageKeys: {
      type: String,
      required: true,
      trim: true,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("ImageList", listOfImages);
