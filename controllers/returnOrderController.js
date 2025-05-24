
const mongoose = require("mongoose");
const ReturnedOrder = require("../models/returnOrderModel");
const { CustomError } = require("../errors/CustomErrorHandler.js");

const createReturnedOrder = async ({
  orderId,
  user_id,
  product_id,
  variant_id,
  quantity,
  price_per_unit,
  returnReason,
  returnImages = [],
}) => {
  try {
    if (
      !orderId || !user_id || !product_id || !quantity || !price_per_unit
    ) {
      throw new CustomError("Missing required fields for return order", 400);
    }

    const total_price = quantity * price_per_unit;

    const returnedDoc = new ReturnedOrder({
      orderId,
      user_id,
      product_id,
      variant_id,
      quantity,
      price_per_unit,
      total_price,
      returnReason,
      returnImages,
      refundStatus: "Pending",
      returnedAt: new Date(),
    });

    const savedDoc = await returnedDoc.save();
    return savedDoc;

  } catch (error) {
    throw error instanceof CustomError
      ? error
      : new CustomError(error.message, 500);
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


