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
    returnImages, // Expected to be from req.files.returnImages (could be a single file or array)
  },
  session
) => {
  try {
    // Validate required fields
    if (!orderId || !user_id || !product_id || !quantity || !price_per_unit) {
      throw new CustomError("Missing required fields for returned order", 400);
    }

    console.log(returnImages)

    const total_price = quantity * price_per_unit;

    // Normalise returnImages to an array if it's a single file
    const imageArray = Array.isArray(returnImages)
      ? returnImages
      : returnImages
      ? [returnImages]
      : [];
    console.log(imageArray);
    const uploadedImageUrls = [];
    const uploadedImageKeys = [];

    for (const image of imageArray) {
      // if (!image || !image.name) continue;
      try {
        const { fileKey, publicUrl } = await s3UploadHandler(image, "returnImage");
        uploadedImageUrls.push(publicUrl);
        uploadedImageKeys.push(fileKey);
      } catch (err) {
        console.error("S3 upload failed:", err);
      }
    }
    console.log(uploadedImageUrls)
    // Create the returned order document
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
      
      const {id,refundStatus, transaction_id } = req.body;
  
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


  const getUserReturnedItems = async (req, res, next) => {
    try {
      const { user_id,page = 1,limit = 10} = req.body;
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
  
        // Lookup product
        {
          $lookup: {
            from: "products",
            localField: "product_id",
            foreignField: "_id",
            as: "product",
          },
        },
        {
          $unwind: {
            path: "$product",
            preserveNullAndEmptyArrays: true,
          },
        },
  
        // Lookup variant (if exists)
        {
          $lookup: {
            from: "productvariantsets",
            localField: "variant_id",
            foreignField: "combinations._id",
            as: "variantSet",
          },
        },
        {
          $unwind: {
            path: "$variantSet",
            preserveNullAndEmptyArrays: true,
          },
        },
        {
          $addFields: {
            variant_combination: {
              $arrayElemAt: [
                {
                  $filter: {
                    input: "$variantSet.combinations",
                    as: "comb",
                    cond: { $eq: ["$$comb._id", "$variant_id"] },
                  },
                },
                0,
              ],
            },
          },
        },
  
        // Projection
        {
          $project: {
            _id: 0,
            orderId: 1,
            returnedAt: 1,
            refundStatus: 1,
            refundedAt: 1,
            transaction_id: 1,
            // returnReason: 1,
            // isInspected: 1,
            quantity: 1,
            price_per_unit: 1,
            total_price: 1,
            // returnImages: 1,
            product_id: 1,
            variant_id: 1,
            "product.product_name": 1,
            "product.imageUrls": 1,
            "product.order_number" : 1,
            variant_combination: 1,
          },
        },
  
        { $sort: { returnedAt: -1 } },
        { $skip: skip },
        { $limit: limit },
      ];
  
      const returnedItems = await ReturnedOrder.aggregate(pipeline);
  
      const totalResult = await ReturnedOrder.aggregate([
        { $match: { user_id: new mongoose.Types.ObjectId(user_id) } },
        { $count: "total" },
      ]);
  
      const total = totalResult[0]?.total || 0;
  
      res.status(200).json({
        success: true,
        total,
        currentPage: page,
        totalPages: Math.ceil(total / limit),
        data: returnedItems,
      });
    } catch (error) {
      next(
        error instanceof CustomError
          ? error
          : new CustomError("GetReturnedOrdersError", error.message, 500)
      );
    }
  };
  

  const getAllReturnedItems = async (req, res, next) => {
    try {
      const {page = 1,limit = 10} = req.body;
      const skip = (page - 1) * limit;
  
      const pipeline = [
        // Lookup product
        {
          $lookup: {
            from: "products",
            localField: "product_id",
            foreignField: "_id",
            as: "product",
          },
        },
        {
          $unwind: {
            path: "$product",
            preserveNullAndEmptyArrays: true,
          },
        },
  
        // Lookup variant (if exists)
        {
          $lookup: {
            from: "productvariantsets",
            localField: "variant_id",
            foreignField: "combinations._id",
            as: "variantSet",
          },
        },
        {
          $unwind: {
            path: "$variantSet",
            preserveNullAndEmptyArrays: true,
          },
        },
        {
          $addFields: {
            variant_combination: {
              $arrayElemAt: [
                {
                  $filter: {
                    input: "$variantSet.combinations",
                    as: "comb",
                    cond: { $eq: ["$$comb._id", "$variant_id"] },
                  },
                },
                0,
              ],
            },
          },
        },
  
        // Projection
        {
          $project: {
            _id: 0,
            orderId: 1,
            returnedAt: 1,
            refundStatus: 1,
            refundedAt: 1,
            transaction_id: 1,
            // returnReason: 1,
            // isInspected: 1,
            quantity: 1,
            price_per_unit: 1,
            total_price: 1,
            // returnImages: 1,
            product_id: 1,
            variant_id: 1,
            "product.product_name": 1,
            "product.imageUrls": 1,
            "product.order_number" : 1,
            variant_combination: 1,
          },
        },
  
        { $sort: { returnedAt: -1 } },
        { $skip: skip },
        { $limit: limit },
      ];
  
      const returnedItems = await ReturnedOrder.aggregate(pipeline);
  
      const totalResult = await ReturnedOrder.aggregate([
        { $match: { user_id: new mongoose.Types.ObjectId(user_id) } },
        { $count: "total" },
      ]);
  
      const total = totalResult[0]?.total || 0;
  
      res.status(200).json({
        success: true,
        total,
        currentPage: page,
        totalPages: Math.ceil(total / limit),
        data: returnedItems,
      });
    } catch (error) {
      next(
        error instanceof CustomError
          ? error
          : new CustomError("GetReturnedOrdersError", error.message, 500)
      );
    }
  };
 
module.exports = {
 createReturnedOrder,
 markAsInspected,
 updateReturnStatus,
 getUserReturnedItems,
 getAllReturnedItems

}


