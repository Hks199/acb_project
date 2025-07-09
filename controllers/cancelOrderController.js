const CancelledOrder = require("../models/cancelOrderModel.js");
const { CustomError } = require("../errors/CustomErrorHandler.js");
const {updateProductsStock} = require("./inventroryController.js");
const {updateVariantsStock} = require("./variantController.js")
const mongoose = require("mongoose");

const createOrUpdateCancelledOrder = async (
  {
    orderId,
    user_id,
    cancelledItems,
    cancellationReason,
    transaction_id, // Optional
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

  // Validate each cancelled item
  for (const item of cancelledItems) {
    if (
      !item.total_price ||
      typeof item.total_price !== "number" ||
      !item.product_id ||
      !item.quantity
    ) {
      throw new CustomError("Invalid or missing fields in cancelledItems", 400);
    }
  }

  // Calculate total refund
  const refundAmount = cancelledItems.reduce(
    (sum, item) => sum + item.total_price,
    0
  );

  try {
    // Check if already cancelled
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

    // Build new cancelled order
    const newCancelledOrder = new CancelledOrder({
      orderId,
      user_id,
      cancelledItems,
      cancellationReason,
      cancelledAt: new Date(),
      refundStatus: "Pending",
      totalRefundAmount: refundAmount,
      isProcessed: false,
      ...(transaction_id ? { transaction_id } : {}), // Avoid inserting null if not provided
    });

    await newCancelledOrder.save({ session });

    // Prepare stock rollback
    const orderedItems = cancelledItems.map((item) => ({
      product_id: item.product_id,
      variant_combination_id: item.variant_combination_id || undefined,
      quantity: -Math.abs(item.quantity), // return positive quantity to restore stock
    }));

    // Restore product and variant stock
    await updateProductsStock(orderedItems, session);
    await updateVariantsStock(orderedItems, session);

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

const getUserCancelledItems = async (req, res, next) => {
  try {
    const {user_id,page=1,limit=10} = req.body;
    const skip = (page - 1) * limit;

    if (!mongoose.Types.ObjectId.isValid(user_id)) {
      return next(new CustomError("InvalidUserId", "Invalid user_id", 400));
    }

    const pipeline = [
      {
        $match: {
          user_id: new mongoose.Types.ObjectId(user_id),
        },
      },
      { $unwind: "$cancelledItems" },

      // Lookup Product Info
      {
        $lookup: {
          from: "products",
          localField: "cancelledItems.product_id",
          foreignField: "_id",
          as: "product",
        },
      },
      { $unwind: { path: "$product", preserveNullAndEmptyArrays: true } },

      // Lookup Variant Info (if exists)
      {
        $lookup: {
          from: "productvariantsets",
          localField: "cancelledItems.variant_combination_id",
          foreignField: "combinations._id",
          as: "variantSet",
        },
      },
      { $unwind: { path: "$variantSet", preserveNullAndEmptyArrays: true } },
      {
        $addFields: {
          variant_combination: {
            $arrayElemAt: [
              {
                $filter: {
                  input: "$variantSet.combinations",
                  as: "comb",
                  cond: {
                    $eq: ["$$comb._id", "$cancelledItems.variant_combination_id"],
                  },
                },
              },
              0,
            ],
          },
        },
      },

      // Final Projection
      {
        $project: {
          _id: 0,
          orderId: 1,
          cancelledAt: 1,
          refundStatus: 1,
          totalRefundAmount: 1,
          transaction_id: 1,
          cancellationReason: 1,
          isProcessed: 1,
          product_id: "$cancelledItems.product_id",
          variant_combination_id: "$cancelledItems.variant_combination_id",
          quantity: "$cancelledItems.quantity",
          price_per_unit: "$cancelledItems.price_per_unit",
          total_price: "$cancelledItems.total_price",
          product_name: "$product.product_name",
          product_image: { $arrayElemAt: ["$product.imageUrls", 0] },
          variant_combination: 1,
        },
      },

      { $sort: { cancelledAt: -1 } },
      { $skip: skip },
      { $limit: limit },
    ];

    const cancelledItems = await CancelledOrder.aggregate(pipeline);

    const totalResult = await CancelledOrder.aggregate([
      { $match: { user_id: new mongoose.Types.ObjectId(user_id) } },
      { $unwind: "$cancelledItems" },
      { $count: "total" },
    ]);
    const total = totalResult[0]?.total || 0;

    res.status(200).json({
      success: true,
      total,
      currentPage: page,
      totalPages: Math.ceil(total / limit),
      data: cancelledItems,
    });
  } catch (error) {
    next(
      error instanceof CustomError
        ? error
        : new CustomError("GetCancelledOrdersError", error.message, 500)
    );
  }
};


module.exports = {
    createOrUpdateCancelledOrder,  
    markCancelledOrderAsProcessed,
    updateRefundStatus,
    getUserCancelledItems
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
  