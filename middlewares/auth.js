const jwt = require("jsonwebtoken");
const User = require("../models/userModel");
const { CustomError } = require("../errors/CustomErrorHandler");

//  **Authentication Middleware**
const authMiddleware = async (req, res, next) => {
  try {
    // 📌 **Extract Token from Cookies or Headers**
    const token = req.headers?.authorization?.split(" ")[1] || req.cookies?.token;

    // 📌 **If No Token, Unauthorized Error**
    if (!token) {
      return next(new CustomError("Unauthorized", "Access denied. No token provided.", 401));
    }

    // 📌 **Verify Token**
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        return next(new CustomError("TokenExpired", "Your session has expired. Please log in again.", 401));
      }
      return next(new CustomError("InvalidToken", "Invalid token. Please log in again.", 400));
    }

    // 📌 **Fetch User (Exclude Password)**
    const user = await User.findById(decoded.id).select("-password");

    // 📌 **If User Not Found**
    if (!user) {
      return next(new CustomError("UserNotFound", "User not found. Please register.", 404));
    }

    req.user = user; // Attach User to Request
    next(); // Proceed to next middleware or controller

  } catch (error) {
    console.error("Auth Middleware Error:", error);
    next(new CustomError("AuthError", "Authentication failed. Please try again.", 500));
  }
};

// **Role-Based Authorization Middleware**
const roleMiddleware = (roles) => (req, res, next) => {
  try {
    // Check if User Has Required Role 
    if (!roles.includes(req.user.role)) {
      return next(new CustomError("Forbidden", "Access forbidden: Insufficient permissions", 403));
    }
    next();
  } catch (error) {
    next(new CustomError("ServerError", error.message, 500));
  }
};

// Export Middleware
module.exports = {
  authMiddleware,
  roleMiddleware
};
