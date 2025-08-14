
const mongoose = require("mongoose");

const vendorSchema = new mongoose.Schema(
  {
    vendor_name: {
      type: String,
      required: true,
      trim: true,
    },
    art_type: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      required: true,
      trim: true,
    },
    imageUrls: {
      type: [String],
      validate: {
        validator: (arr) => arr.every((url) => typeof url === "string"),
        message: "All image URLs must be strings.",
      },
    },
    imageKeys : {
      type: [String],
      validate: {
        validator: (arr) => arr.every((url) => typeof url === "string"),
        message: "All image keys must be strings.",
      },
    },
    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      match: [
        /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/,
        "Please enter a valid email address",
      ],
    },
    mobile_number: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      match: [/^\d{10,15}$/, "Please enter a valid mobile number"],
    },
    gender: {
      type: String,
      enum: ["Male", "Female", "Other"],
    },
    landmark: {
      type: String,
      default: "",
    },
    state: {
      type: String,
    },
    city: {
      type: String,
    },
    country: {
      type: String,
      trim: true,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Vendor", vendorSchema);
