class CustomError extends Error {
    constructor(customError = "Something went wrong", message = "An error occurred", statusCode = 500) {
      super(message);
      this.name = "CustomError";
      this.customError = customError;
      this.statusCode = statusCode;
  
      Error.captureStackTrace(this, this.constructor); // Captures stack trace for debugging
    }
  }
  
  // 🛠 Global Error Handler Middleware
  const errorHandler = (err, req, res, next) => {
    console.error("🔥 Error Stack Trace:", err.stack || err);
  
    if (err instanceof CustomError) {
      return res.status(err.statusCode).json({
        success: false,
        errorType: err.customError,
        message: err.message,
      });
    }
  
    res.status(500).json({
      success: false,
      errorType: "ServerError",
      message: "Something went wrong on the server",
    });
  };
  
  // ✅ Export
  module.exports = {CustomError,errorHandler};
  