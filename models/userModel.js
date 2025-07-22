const mongoose = require("mongoose");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
require("dotenv").config();

// User Schema  
const userSchema = new mongoose.Schema(
  {
    first_name: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      unique: true, // Prevent duplicate emails
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
    pin_code : {
     type : String,
     trim : true
    },
    password: {
      type: String,
      required: true,
      minlength: [8, "Password must be at least 8 characters"],
    }, 
    // **OTP Fields**
    otp: {
      type: String, // OTP for authentication purposes
      minlength: [6, "OTP must be 6 digits"],
      maxlength: [6, "OTP must be 6 digits"],
    },
    otpExpires: {
      type: Date, // OTP Expiry Time
    },
    role: {
      type: String,
      required: true,
      enum: ["Customer", "Admin"], // Define roles (e.g., User or Admin)
      default: "User", // Default role for a user
    },
    // isActive : {
    //   type: Boolean,
    // },
    isOtpVerify : {
      type: Boolean,
      default : false
    }
  },
  { timestamps: true } // Automatically adds createdAt & updatedAt
);

// **Middleware: Hash Password Before Saving**
userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next(); // Only hash if password is modified

  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// **Method: Compare Passwords**
userSchema.methods.comparePassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

// **Method: Generate OTP & Set Expiration**
userSchema.methods.generateOtp = function () {
  const otp = Math.floor(100000 + Math.random() * 900000).toString(); // 6-digit OTP
  this.otp = otp;
  this.otpExpires = Date.now() + 5 * 60 * 1000; // OTP expires in 5 minutes
  return otp;
};

// **Method: Verify OTP**
userSchema.methods.verifyOtp = function (enteredOtp) {
  if (this.otp !== enteredOtp) return false;
  if (this.otpExpires < Date.now()) return false; // Check if OTP is expired
  return true;
};

// Method to Generate Token
userSchema.methods.generateToken = function () {
  return jwt.sign({ id: this._id, role: this.role }, process.env.JWT_SECRET, {
    expiresIn: "7d", // Token valid for 7 days
  });
};

// **Export Model**
const User = mongoose.model("User", userSchema);
module.exports = User;
