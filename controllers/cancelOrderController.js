const CancelledOrder = require("../models/cancelOrderModel.js");
const { CustomError } = require("../errors/CustomErrorHandler.js");

const createOrUpdateCancelledOrder = async (
  {
    orderId,
    user_id,
    cancelledItems,
    cancellationReason,
  },
  session
) => {
  if (
    !orderId ||
    !user_id ||
    !Array.isArray(cancelledItems) ||
    cancelledItems.length === 0
  ) {
    throw new CustomError("Missing required fields or cancelledItems array is empty", 400);
  }

  // Validate cancelledItems content
  for (const item of cancelledItems) {
    if (!item.total_price || typeof item.total_price !== "number") {
      throw new CustomError("Each cancelled item must have a valid total_price", 400);
    }
  }

  // Calculate refund amount
  const refundAmount = cancelledItems.reduce((sum, item) => sum + item.total_price, 0);

  try {
    let cancelledOrder = await CancelledOrder.findOne({ orderId }).session(session);

    if (cancelledOrder) {
      // Update existing cancelled order
      cancelledOrder.cancelledItems.push(...cancelledItems);
      cancelledOrder.totalRefundAmount += refundAmount;

      if (cancellationReason) {
        cancelledOrder.cancellationReason = cancellationReason;
      }

      await cancelledOrder.save({ session });

      return {
        success: true,
        message: "Cancelled order updated successfully",
        data: cancelledOrder,
      };
    }

    // Create new cancelled order
    const newCancelledOrder = new CancelledOrder({
      orderId,
      user_id,
      cancelledItems,
      cancellationReason,
      cancelledAt: new Date(),
      refundStatus: "Pending",
      totalRefundAmount: refundAmount,
      isProcessed: false,
    });

    await newCancelledOrder.save({ session });

    return {
      success: true,
      message: "Cancelled order created successfully",
      data: newCancelledOrder,
    };
  } catch (error) {
    throw error instanceof CustomError
      ? error
      : new CustomError(error.message || "Failed to process cancelled order", 500);
  }
};

// PATCH /api/cancelled-orders/:id/process
const markCancelledOrderAsProcessed = async (req, res, next) => {
  try {
    const { id } = req.params;

    const cancelledOrder = await CancelledOrder.findById(id);

    if (!cancelledOrder) {
      return next(new CustomError("NotFound", "Cancelled order not found", 404));
    }

    if (cancelledOrder.isProcessed) {
      return res.status(200).json({
        success: true,
        message: "Cancelled order already processed",
      });
    }

    cancelledOrder.isProcessed = true;
    await cancelledOrder.save();

    res.status(200).json({
      success: true,
      message: "Cancelled order marked as processed",
      data: cancelledOrder,
    });
  } catch (error) {
    next(new CustomError("UpdateFailed", error.message, 500));
  }
};

// PATCH /api/cancelled-orders/:id/refund-status
const updateRefundStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { refundStatus, transaction_id } = req.body;

    if (!refundStatus) {
      return next(new CustomError("BadRequest", "Refund status is required", 400));
    }

    if (!["Pending", "Processed", "NotRequired"].includes(refundStatus)) {
      return next(new CustomError("InvalidStatus", "Invalid refund status value", 400));
    }

    const cancelledOrder = await CancelledOrder.findById(id);

    if (!cancelledOrder) {
      return next(new CustomError("NotFound", "Cancelled order not found", 404));
    }

    cancelledOrder.refundStatus = refundStatus;

    if (refundStatus === "Processed") {
      cancelledOrder.transaction_id = transaction_id;
    }

    await cancelledOrder.save();

    res.status(200).json({
      success: true,
      message: "Refund status updated successfully",
      data: cancelledOrder,
    });
  } catch (error) {
    next(new CustomError("RefundUpdateError", error.message, 500));
  }
};


module.exports = {
    createOrUpdateCancelledOrder,  
    markCancelledOrderAsProcessed,
    updateRefundStatus
};





// {
//     "orderId": "665f2d9d65a5d64326d2a4bb",
//     "user_id": "665e9b61c62f8037fc6ab499",
//     "cancelledItems": [
//       {
//         "product_id": "665f2e3565a5d64326d2a4bc",
//         "variant_id": "665f2e6f65a5d64326d2a4bd",
//         "quantity": 1,
//         "price_per_unit": 500,
//         "total_price": 500
//       }
//     ],
//     "cancellationReason": "Changed my mind",
//   }
  