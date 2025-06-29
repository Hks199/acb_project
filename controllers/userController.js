const User = require("../models/userModel.js");
const { CustomError } = require("../errors/CustomErrorHandler.js");
const { sendOTP } = require("../helpers/nodeMailer.js")
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

// **Register User & Send OTP**
const registerUser = async (req, res, next) => {
  try {
    const { first_name, last_name,role, email, mobile_number, password,gender,landmark,state, city, country } = req.body;

    // **Check if Password is Strong**
    if (!password || password.length < 8) {
      return next(new CustomError("WeakPassword", "Password must be at least 8 characters long", 400));
    }

    // **Check if User Already Exists** 
    const existingUser = await User.findOne({ email });

    if(existingUser) {
        return next(new CustomError("UserExists", "User already registered and verified. Please login.", 400));
    }

    // **Create New User (without OTP initially)**
    const user = new User({
      first_name,
      last_name,
      email,
      mobile_number,
      password,
      role,
      gender,
      landmark,
      state, 
      city,
      country,
    });

    // **Generate OTP & Set Expiration**
    // const otp = user.generateOtp();
    await user.save();

    // **Send OTP via Email**
    // await sendOTP(otp, user.email, user.first_name);

    //**Response**
    res.status(201).json({
      success: true,
      message: "User registered successfully.",
    });

  } catch (error) {
    next(new CustomError("UserCreationError", error.message, 500));
  }
};


// **Verify OTP**
const verifyOtp = async (req, res, next) => {
  try {
    const { email, otp } = req.body;

    // Check if user exists
    const user = await User.findOne({ email });
    if (!user) {
      return next(new CustomError("UserNotFound", "User not found", 404));
    }

    // Check OTP Validity
    const isValid = user.verifyOtp(otp);
    if (!isValid) {
      return next(new CustomError("InvalidOTP", "OTP is incorrect or expired", 400));
    }

    // Activate User
    // user.isActive = true;
    user.isOtpVerify = true;

    user.otp = null;
    user.otpExpires = null;

    await user.save();

    // OTP Verified Successfully
    res.json({ success: true, message: "OTP verified successfully!" });
  } catch (error) {
    next(new CustomError("OtpVerificationError", error.message, 500));
  }
};


// **Login User**
const loginUser = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    // 📌 **Check if user exists**
    const user = await User.findOne({ email });

    if (!user) {
      return next(new CustomError("UserNotFound", "User not found. Please register first.", 404));
    }

    // 📌 **Check if password is correct**
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return next(new CustomError("InvalidCredentials", "Incorrect password. Please try again.", 400));
    }

    // 📌 **Check if user is active**
    // if (!user.isActive) {
    //   // **Generate OTP & Set Expiration**
    //   const otp = user.generateOtp();
    //   await user.save();

    //   // **Send OTP via Email**
    //   await sendOTP(otp, user.email, user.first_name);

    //   return res.status(400).json({
    //     success: false,
    //     error: "UnverifiedUser",
    //     message: "Your account is not verified. OTP sent to your email. Please verify your email.",
    //   });
    // }

    // 📌 **Reset OTP verification status after login**
    // user.isOtpVerify = false;
    // await user.save();

    // 📌 **Generate JWT Token**
    const token = jwt.sign(
      {
        id: user._id,
        name: `${user.first_name} ${user.last_name}`,
        email: user.email,
        role: user.role,
      },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRY || "7d" }
    );

    // 📌 **Set JWT in HTTP-only Cookie**
    res.cookie("token", token, {
      httpOnly: true, 
      secure: process.env.NODE_ENV === "production",     
      sameSite: "strict",
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    // 📌 **Success Response**
    res.status(200).json({
      success: true,
      message: "Login successful!",
      token,
    });

  } catch (error) {
    console.error("Login Error:", error);
    next(new CustomError("LoginError", "An unexpected error occurred while logging in. Please try again later.", 500));
  }
};

// **Forgot Password (Send OTP)**
const forgotPassword = async (req, res, next) => {
  try {
    const { email } = req.body;

    //  Check if user exists
    const user = await User.findOne({ email });
    if (!user) {
      return next(new CustomError("UserNotFound", "User not found", 404));
    }

    // Generate OTP & Set Expiration
    const otp = user.generateOtp();

    await user.save();

    // Send OTP via Email
    await sendOTP(otp, user.email, user.first_name);

    res.status(200).json({
      success: true,
      message: "OTP sent to your email.",
    });
  } catch (error) {
    next(new CustomError("EmailError", error.message, 500));
  }
};


// **Update Password API (Using OTP)**
const updatePassword = async (req, res, next) => {
  try {
    const { email, newPassword, confirmPassword } = req.body;

    //  Check if user exists
    const user = await User.findOne({ email });
    if (!user) {
      return next(new CustomError("UserNotFound", "User not found", 404));
    }

    //  Verify OTP
    if (!user.isOtpVerify) {
      return res.status(400).json({
        success: false,
        error: "UnverifiedUser",
        message: "OTP is not verified",
      });
    }
   
    // Check if new password is strong
    if (newPassword.length < 8) {
      return next(new CustomError("WeakPassword", "Password must be at least 8 characters long", 400));
    }

    // **Check if newPassword matches confirmPassword**
    if (newPassword !== confirmPassword) {
      return next(new CustomError("PasswordMismatch", "New Password and Confirm Password do not match", 400));
    }

    // **Update the password (Will be hashed by Mongoose middleware)**
    user.password = newPassword;
    // user.isOtpVerify = false;

    await user.save(); // Password will be hashed automatically

    res.status(200).json({
      success: true,
      message: "Password updated successfully.",
    });
  } catch (error) {
    next(new CustomError("ServerError", error.message, 500));
  }
};

//  **Logout API**
const logoutUser = async (req, res, next) => {
  try {
    //  **Clear the authentication cookie**
    res.clearCookie("token", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production", // Secure cookie in production
      sameSite: "strict",
    });

    //  **Send Response**
    res.status(200).json({
      success: true,
      message: "Logged out successfully",
    });
  } catch (error) {
    next(new CustomError("LogoutError", "Error logging out", 500));
  }
};

// Read All Users
const getAllUsers = async (req, res, next) => {
    try {
      const { role } = req.query; // e.g. /api/users?role=User
  
      let query = {};
      if (role) {
        query.role = role;
      }
  
      const users = await User.find(query).select("-password");
  
      res.status(200).json(users);
    } catch (error) {
      next(new CustomError("DatabaseError", "Failed to retrieve users", 500));
    }
  };
  

// Read Single User
const getUserById = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id).select("-password");
    if (!user) {
      return next(new CustomError("UserNotFound", "User not found", 404));
    }
    const userData = {
      firstName : user.first_name,
      lastName : user.last_name,
      role : user.role,
      email : user.email,
      mobile_number : user.mobile_number,
      gender: user.gender,
      landmark: user.landmark,
      state: user.state,
      city: user.city,
      country: user.country,
    }
    res.status(200).json({status:"success", userData});
  } catch (error) {
    next(new CustomError("DatabaseError", "Error retrieving user", 500));
  }
};

// Update User
const updateUser = async (req, res, next) => {
  try {
    const user = await User.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    }).select("-password");

    if (!user) {
      return next(new CustomError("UserNotFound", "User not found", 404));
    }

    res.status(200).json({ message: "User updated successfully", user });
  } catch (error) {
    next(new CustomError("UpdateError", "Error updating user", 400));
  }
};

// Delete User
const deleteUser = async (req, res, next) => {
  try {
    const user = await User.findByIdAndDelete(req.params.id);
    if (!user) {
      return next(new CustomError("UserNotFound", "User not found", 404));
    }

    res.status(200).json({ message: "User deleted successfully" });
  } catch (error) {
    next(new CustomError("DeleteError", "Error deleting user", 500));
  }
};

const getUserStatistics = async (req, res, next) => {
  try {
    const { startDate, endDate } = req.body; // Get date range from request body

    // Convert startDate and endDate to Date objects
    const start = new Date(startDate);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999); // Set end of the day

    const userStats = await User.aggregate([
      {
        $match: {
          createdAt: { $gte: start, $lte: end }, // Filter users within date range
        },
      },
      {
        $group: {
          _id: null,
          totalUsers: { $sum: 1 }, // Count total users
          totalActiveUsers: {
            $sum: { $cond: [{ $eq: ["$isActive", true] }, 1, 0] }, // Count active users
          },
        },
      },
    ]);

    // Extract statistics
    const totalUsers = userStats.length ? userStats[0].totalUsers : 0;
    const totalActiveUsers = userStats.length ? userStats[0].totalActiveUsers : 0;

    res.status(200).json({
      success: true,
      totalUsers,
      totalActiveUsers,
    });

  } catch (error) {
    next(new CustomError("AggregationError", error.message, 500));
  }
};

const getUserByAuthToken = async (req, res, next) => {
  try {
    const userId = req.user?._id; // From auth middleware

    if (!userId) {
      return next(new CustomError("Unauthorized", "User ID not found in request", 401));
    }

    const user = await User.findById(userId).select("-password");

    if (!user) {
      return next(new CustomError("UserNotFound", "User not found", 404));
    }

    const userData = {
      firstName: user.first_name,
      lastName: user.last_name,
      role: user.role,
      email: user.email,
      mobile_number: user.mobile_number,
      gender: user.gender,
      landmark: user.landmark,
      state: user.state,
      city: user.city,
      country: user.country,
    };

    res.status(200).json({ status: "success", userData });
  } catch (error) {
    next(new CustomError("DatabaseError", "Error retrieving user", 500));
  }
};



module.exports = {
  registerUser,
  verifyOtp,
  loginUser,
  forgotPassword,
  updatePassword,
  logoutUser,
  getAllUsers,
  getUserById,
  updateUser,
  deleteUser,
  getUserStatistics,
  getUserByAuthToken
};
