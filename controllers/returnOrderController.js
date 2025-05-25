const mongoose = require("mongoose");
const ReturnedOrder = require("../models/returnOrderModel");
const { CustomError } = require("../errors/CustomErrorHandler.js");
const {s3UploadHandler,s3DeleteHandler,s3ReplaceHandler} = require("../helpers/s3BucketUploadHandler");

const createReturnedOrder = async (
  {
    orderId,
    user_id,
    product_id,
    variant_id,
    quantity,
    price_per_unit,
    returnReason,
    returnImages, // Array of image files (e.g., from req.files.returnImages)
  },
  session
) => {
  try {
    if (!orderId || !user_id || !product_id || !quantity || !price_per_unit) {
      throw new CustomError("Missing required fields for returned order", 400);
    }

    const total_price = quantity * price_per_unit;
    const uploadedImageUrls = [];
    const uploadedImageKeys = [];

    if (Array.isArray(returnImages) && returnImages.length > 0) {
      for (const image of returnImages) {
        if (!image) continue;

        const { fileKey, publicUrl } = await s3UploadHandler(image, "return-orders");
        uploadedImageUrls.push(publicUrl);
        uploadedImageKeys.push(fileKey);
      }
    }

    const returnedOrder = new ReturnedOrder({
      orderId,
      user_id,
      product_id,
      variant_id,
      quantity,
      price_per_unit,
      total_price,
      returnReason,
      returnImages: uploadedImageUrls,
      imageKeys: uploadedImageKeys,
      refundStatus: "Pending",
      returnedAt: new Date(),
    });

    const savedOrder = await returnedOrder.save({ session });

    return savedOrder;
  } catch (error) {
    throw error instanceof CustomError
      ? error
      : new CustomError(error.message || "Failed to create returned order", 500);
  }
};


const markAsInspected = async (req, res, next) => {
    try {
      const { id } = req.params;
  
      const returnedOrder = await ReturnedOrder.findById(id);
  
      if (!returnedOrder) {
        return next(new CustomError("Returned order not found", 404));
      }
  
      // Only update if not already inspected
      if (returnedOrder.isInspected) {
        return res.status(200).json({
          success: true,
          message: "This return is already marked as inspected",
          data: returnedOrder,
        });
      }
  
      returnedOrder.isInspected = true;
      await returnedOrder.save();
  
      return res.status(200).json({
        success: true,
        message: "Return marked as inspected",
        data: returnedOrder,
      });
    } catch (error) {
      next(new CustomError(error.message, 500));
    }
  };

  const updateReturnStatus = async (req, res, next) => {
    try {
      const { id } = req.params;
      const {refundStatus, transaction_id } = req.body;
  
      if (!refundStatus) {
        return next(new CustomError("Return status is required", 400));
      }
  
      if (!["Pending", "Processed", "NotRequired"].includes(refundStatus)) {
        return next(new CustomError("Invalid return status", 400));
      }
  
      const returnedOrder = await ReturnedOrder.findById(id);
  
      if (!returnedOrder) {
        return next(new CustomError("Returned order not found", 404));
      }
  
      returnedOrder.refundStatus = refundStatus;
  
      if (refundStatus === "Processed") {
        returnedOrder.transaction_id = transaction_id;
      }
  
      await returnedOrder.save();
  
      return res.status(200).json({
        success: true,
        message: "Return status updated successfully",
        data: returnedOrder,
      });
    } catch (error) {
      next(new CustomError(error.message, 500));
    }
  };  
 
module.exports = {
 createReturnedOrder,
 markAsInspected,
 updateReturnStatus
}


