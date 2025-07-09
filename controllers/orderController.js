const Order = require("../models/orderModel");
const razorpay = require("../helpers/razorpayInstance");
const { CustomError } = require("../errors/CustomErrorHandler.js");
const crypto = require("crypto");
const {createOrUpdateCancelledOrder} = require("./cancelOrderController.js")
const {createReturnedOrder} = require("./returnOrderController.js")
const {updateProductsStock} = require("./inventroryController.js");
const {updateVariantsStock} = require("./variantController.js")
const mongoose = require("mongoose");


const createOrder = async (req, res, next) => {
  const session = await mongoose.startSession();
  try {
    session.startTransaction();

    const {
      user_id,
      orderedItems,
      shippingAddress,
      paymentMethod,
      subtotal,
      tax = 0,
      deliveryCharge = 0,
    } = req.body;

    const totalAmount = subtotal + tax + deliveryCharge;

    // Step 1: Create Razorpay order
    // const razorpayOrder = await razorpay.orders.create({
    //   amount: totalAmount * 100, // paise
    //   currency: "INR",
    //   receipt: `receipt_${Date.now()}`,
    // });

    // Step 2: Save order in DB inside transaction
    const order = await Order.create(
      [
        {
          user_id,
          orderedItems,
          shippingAddress,
          paymentMethod,
          subtotal,
          tax,
          deliveryCharge,
          totalAmount,
          // razorpayOrderId: razorpayOrder.id,
          // currency: razorpayOrder.currency,
          razorpayOrderId: "RAZORPAY2025",
          currency: "INR"
        },
      ],
      { session } 
    );

    // Step 3: Update stocks using the same session
    await updateProductsStock(orderedItems, session);
    await updateVariantsStock(orderedItems, session);

    await session.commitTransaction();
    session.endSession();

    res.status(201).json({
      success: true,
      order: order[0], // created via array
      // razorpayOrder: {
      //   id: razorpayOrder.id,
      //   amount: razorpayOrder.amount,
      //   currency: razorpayOrder.currency,
      // },
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    next(
      error instanceof CustomError
        ? error
        : new CustomError("CreateOrderError", error.message, 500)
    );
  }
};


const verifyPayment = async (req, res, next) => {
  try {
    const { razorpay_payment_id, razorpay_order_id, razorpay_signature } = req.body;

    const generated_signature = crypto
      .createHmac("sha256", process.env.RAZORPAY_SECRET)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest("hex");

    if (generated_signature !== razorpay_signature) {
      return next(new CustomError("SignatureMismatch", "Invalid payment signature", 400));
    }

    // Update order status in DB
    const order = await Order.findOneAndUpdate(
      { razorpayOrderId: razorpay_order_id },
      {
        razorpayPaymentId: razorpay_payment_id,
        paymentStatus: "Paid",
        orderStatus: "Confirmed",
      },
      { new: true }
    );

    if (!order) {
      return next(new CustomError("OrderNotFound", "Order not found for verification", 404));
    }

    res.status(200).json({
      success: true,
      message: "Payment verified successfully",
      order,
    });
  } catch (error) {
    next(new CustomError("PaymentVerificationError", error.message, 500));
  }
};

// const handleCustomerOrderAction = async (req, res, next) => {
//     try {
//       const { orderId } = req.params;
//       const { user_id, action, reason } = req.body;
  
//       const order = await Order.findById(orderId);
//       if (!order) return next(new CustomError("NotFound", "Order not found", 404));
  
//       if (order.user_id.toString() !== user_id)
//         return next(new CustomError("Unauthorized", "You cannot modify this order", 403));
  
//       if (action === "cancel") {
//         if (!["Pending", "Confirmed"].includes(order.orderStatus)) {
//           return next(new CustomError("InvalidState", "Order cannot be cancelled", 400));
//         }
//         order.orderStatus = "Cancelled";
//         order.cancelledAt = new Date();
//         order.cancellationReason = reason || "No reason provided";
//       }
//       //  else if (action === "return") {
//       //   if (order.orderStatus !== "Delivered") {
//       //     return next(new CustomError("InvalidState", "Only delivered orders can be returned", 400));
//       //   }
//       //   order.orderStatus = "Returned";
//       //   order.returnedAt = new Date();
//       //   order.returnReason = reason || "No reason provided";
//       // }
//        else {
//         return next(new CustomError("BadRequest", "Invalid customer action", 400));
//       }
  
//       await order.save();
//       res.status(200).json({ success: true, message: `Order ${action}ed`, order });
//     } catch (error) {
//       next(new CustomError("CustomerOrderActionError", error.message, 500));
//     }
//   };


const handleAdminOrderAction = async (req, res, next) => {
  try {
    const { action,orderId} = req.body;

    const order = await Order.findById(orderId);
    if (!order) return next(new CustomError("NotFound", "Order not found", 404));

    const currentStatus = order.orderStatus;

    // Allowed transitions mapping
    const allowedTransitions = {
      Pending: "confirmed",
      Confirmed: "shipped",
      Shipped: "delivered"
    };

    // Normalize to lowercase for safe comparison
    const normalizedAction = action?.toLowerCase();

    // Check if action is valid from current status
    if (allowedTransitions[currentStatus] !== normalizedAction) {
      return next(new CustomError(
        "InvalidAction",
        `Invalid action "${action}" for current order status "${currentStatus}". Expected action: "${allowedTransitions[currentStatus]}"`,
        400
      ));
    }

    // Update order based on valid transition
    if (normalizedAction === "confirmed") {
      order.orderStatus = "Confirmed";
    } else if (normalizedAction === "shipped") {
      order.orderStatus = "Shipped";
      order.shippedAt = new Date();
    } else if (normalizedAction === "delivered") {
      order.orderStatus = "Delivered";
      order.deliveredAt = new Date();
    }

    await order.save();

    res.status(200).json({
      success: true,
      message: `Order status updated to "${order.orderStatus}"`,
      // order
    });
  } catch (error) {
    next(new CustomError("AdminOrderActionError", error.message, 500));
  }
};


  const cancelOrReturnOrderItem = async (req, res, next) => {
    const session = await mongoose.startSession();
  
    try {
      session.startTransaction();
  
      const {
        returnReason,
        status,
        user_id,
        cancellationReason,
        orderId,
        productId
      } = req.body;
  
      const returnImages = req.files?.returnImages;
      // Validate ObjectIds
      if (!mongoose.Types.ObjectId.isValid(orderId) || !mongoose.Types.ObjectId.isValid(productId)) {
        throw new CustomError("InvalidObjectId", "Invalid orderId or productId", 400);
      }
  
      const order = await Order.findById(orderId).session(session);
      if (!order) {
        throw new CustomError("NotFound", "Order not found", 404);
      }
  
      // Verify the user owns the order
      if (order.user_id.toString() !== user_id) {
        throw new CustomError("Unauthorized", "User not authorized to modify this order", 403);
      }
  
      // Validate status transition
      if (status === "Cancelled" && !["Pending", "Confirmed"].includes(order.orderStatus)) {
        throw new CustomError("InvalidState", "Only Pending or Confirmed orders can be cancelled", 400);
      }
  
      if (status === "Returned" && order.orderStatus !== "Delivered") {
        throw new CustomError("InvalidState", "Only Delivered orders can be returned", 400);
      }
  
      // Find the item to cancel/return
      const targetItem = order.orderedItems.find(
        item => item.product_id.toString() === productId
      );
  
      if (!targetItem) {
        throw new CustomError("NotFound", "Product not found in order", 404);
      }
  
      // Remove item from orderedItems
      order.orderedItems = order.orderedItems.filter(
        item => item.product_id.toString() !== productId
      );
  
      if (order.orderedItems.length === 0) {
        order.isDeleted = true;
      }
  
      await order.save({ session });
  
      const cancelledItems = [{
        product_id: targetItem.product_id,
        variant_combination_id: targetItem.variant_combination_id,
        quantity: targetItem.quantity,
        price_per_unit: targetItem.price_per_unit,
        total_price: targetItem.total_price,
      }];
  
      // Handle cancellation
      if (status === "Cancelled") {
        await createOrUpdateCancelledOrder(
          {
            orderId,
            user_id,
            cancelledItems,
            cancellationReason,
          },
          session
        ); 
      }
  
      // Handle return
      if (status === "Returned") {
        const imageArray = Array.isArray(returnImages)
          ? returnImages.map(img => img.name)
          : returnImages ? [returnImages.name] : [];
  
        await createReturnedOrder({
          orderId, 
          user_id,
          product_id: targetItem.product_id,
          variant_id: targetItem.variant_id,
          quantity: targetItem.quantity,
          price_per_unit: targetItem.price_per_unit,
          returnReason,
          returnImages: imageArray,
        }, session);
      }
  
      await session.commitTransaction();
      session.endSession();
  
      return res.status(200).json({
        success: true,
        message: `${status} successful for the item`,
        // removedItem: cancelledItems[0],
        // updatedOrder: order,
      });
  
    } catch (err) {
      await session.abortTransaction();
      session.endSession();
      console.error("Cancel/Return with Transaction Error:", err);
      next(err instanceof CustomError ? err : new CustomError("ServerError", err.message, 500));
    }
  };
  
  
  
  const getUserOrderedProducts = async (req, res, next) => {
    try {
      const { user_id ,page = 1, limit = 10,} = req.body;
      const skip = (page - 1) * limit;
  
      if (!mongoose.Types.ObjectId.isValid(user_id)) {
        return next(new CustomError("InvalidUserId", "Invalid user_id", 400));
      }
  
      const pipeline = [
        {
          $match: {
            user_id: new mongoose.Types.ObjectId(user_id),
            isDeleted: false,
          },
        },
        { $unwind: "$orderedItems" },
  
        // Product lookup
        {
          $lookup: {
            from: "products",
            localField: "orderedItems.product_id",
            foreignField: "_id",
            as: "product",
          },
        },
        { $unwind: { path: "$product", preserveNullAndEmptyArrays: true } },
  
        // Variant lookup
        {
          $lookup: {
            from: "productvariantsets",
            localField: "orderedItems.variant_combination_id",
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
                      $eq: ["$$comb._id", "$orderedItems.variant_combination_id"],
                    },
                  },
                },
                0,
              ],
            },
          },
        },
  
        // Final projection
        {
          $project: {
            _id: 0,
            order_id: "$_id",
            product_id: "$orderedItems.product_id",
            product_name: "$product.product_name",
            product_image: { $arrayElemAt: ["$product.imageUrls", 0] },
            quantity: "$orderedItems.quantity",
            price_per_unit: "$orderedItems.price_per_unit",
            total_price: "$orderedItems.total_price",
            variant_combination: 1,
            orderStatus: 1,
            // paymentStatus: 1,
            // paymentMethod: 1,
            orderedAt: "$createdAt",
            // razorpayOrderId: 1,
            // razorpayPaymentId: 1,
            shippedAt: 1,
            deliveredAt: 1,
          },
        },
  
        // Sort by orderedAt
        { $sort: { orderedAt: -1 } },
  
        // Pagination
        { $skip: skip },
        { $limit: limit },
      ];
  
      const orderedProducts = await Order.aggregate(pipeline);
  
      const totalCountResult = await Order.aggregate([
        {
          $match: {
            user_id: new mongoose.Types.ObjectId(user_id),
            isDeleted: false,
          },
        },
        { $unwind: "$orderedItems" },
        { $count: "total" },
      ]);
  
      const total = totalCountResult[0]?.total || 0;
  
      return res.status(200).json({
        success: true,
        count: orderedProducts.length,
        total,
        currentPage: page,
        totalPages: Math.ceil(total / limit),
        data: orderedProducts,
      });
    } catch (error) {
      next(
        error instanceof CustomError
          ? error
          : new CustomError("GetUserOrdersError", error.message, 500)
      );
    }
  };
  
  
  

module.exports = {
    createOrder,
    verifyPayment,
    // handleCustomerOrderAction,
    handleAdminOrderAction,
    cancelOrReturnOrderItem,
    getUserOrderedProducts,
    

  }


// {
//     "user_id": "665ff509c1bb031f80be6742",
//     "orderedItems": [
//       {
//         "product_id": "665ff5efc1bb031f80be6749",
//         "variant_id": "665ff9a3c1bb031f80be674f",
//         "vendor_id": "665ff509c1bb031f80be6731",
//         "quantity": 2,
//         "price_per_unit": 200,
//         "total_price": 400
//       }
//     ],
//     "shippingAddress": {
//       "fullName": "John Doe",
//       "mobile": "9876543210",
//       "addressLine1": "123 Lane",
//       "city": "Delhi",
//       "state": "Delhi",
//       "postalCode": "110001",
//       "country": "India"
//     },
//     "paymentMethod": "UPI",
//     "subtotal": 400,
//     "tax": 40,
//     "deliveryCharge": 60
//   }
  