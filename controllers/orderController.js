const Order = require("../models/orderModel");
const razorpay = require("../helpers/razorpayInstance");
const { CustomError } = require("../errors/CustomErrorHandler.js");
const crypto = require("crypto");
const {createOrUpdateCancelledOrder} = require("./cancelOrderController.js")
const {createReturnedOrder} = require("./returnOrderController.js")
const mongoose = require("mongoose");


const createOrder = async (req, res, next) => {
  try {
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

    // STEP 1: Create Razorpay order
    const razorpayOrder = await razorpay.orders.create({
      amount: totalAmount * 100, // in paise
      currency: "INR",
      receipt: `receipt_${Date.now()}`,
    });

    // STEP 2: Save order to DB
    const order = await Order.create({
      user_id,
      orderedItems,
      shippingAddress,
      paymentMethod,
      subtotal,
      tax,
      deliveryCharge,
      totalAmount,
      razorpayOrderId: razorpayOrder.id,
      currency: razorpayOrder.currency,
    });

    res.status(201).json({
      success: true,
      order,
      razorpayOrder: {
        id: razorpayOrder.id,
        amount: razorpayOrder.amount,
        currency: razorpayOrder.currency,
      },
    });
  } catch (error) {
    next(new CustomError("CreateOrderError", error.message, 500));
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

const handleCustomerOrderAction = async (req, res, next) => {
    try {
      const { orderId } = req.params;
      const { user_id, action, reason } = req.body;
  
      const order = await Order.findById(orderId);
      if (!order) return next(new CustomError("NotFound", "Order not found", 404));
  
      if (order.user_id.toString() !== user_id)
        return next(new CustomError("Unauthorized", "You cannot modify this order", 403));
  
      if (action === "cancel") {
        if (!["Pending", "Confirmed"].includes(order.orderStatus)) {
          return next(new CustomError("InvalidState", "Order cannot be cancelled", 400));
        }
        order.orderStatus = "Cancelled";
        order.cancelledAt = new Date();
        order.cancellationReason = reason || "No reason provided";
      }
      //  else if (action === "return") {
      //   if (order.orderStatus !== "Delivered") {
      //     return next(new CustomError("InvalidState", "Only delivered orders can be returned", 400));
      //   }
      //   order.orderStatus = "Returned";
      //   order.returnedAt = new Date();
      //   order.returnReason = reason || "No reason provided";
      // }
       else {
        return next(new CustomError("BadRequest", "Invalid customer action", 400));
      }
  
      await order.save();
      res.status(200).json({ success: true, message: `Order ${action}ed`, order });
    } catch (error) {
      next(new CustomError("CustomerOrderActionError", error.message, 500));
    }
  };
  
const handleAdminOrderAction = async (req, res, next) => {
    try {
      const { orderId } = req.params;
      const { action } = req.body;
  
      const order = await Order.findById(orderId);
      if (!order) return next(new CustomError("NotFound", "Order not found", 404));
  
      if (action === "shipped") {
        order.orderStatus = "Shipped";
        order.shippedAt = new Date();
      } else if (action === "delivered") {
        order.orderStatus = "Delivered";
        order.deliveredAt = new Date();
      } else if (action === "refunded") {
        order.orderStatus = "Refunded";
        order.refundedAt = new Date();
      } else {
        return next(new CustomError("BadRequest", "Invalid admin action", 400));
      }
  
      await order.save();
      res.status(200).json({ success: true, message: `Order marked as ${action}`, order });
    } catch (error) {
      next(new CustomError("AdminOrderActionError", error.message, 500));
    }
  };



const cancelOrReturnOrderItem = async (req, res, next) => {
    const session = await mongoose.startSession();
  
    try {
      session.startTransaction();
  
    const { returnImages,returnReason,status, user_id, cancellationReason, orderId, productId } = req.params;
  
      // Validate ObjectIds
      if (!mongoose.Types.ObjectId.isValid(orderId) || !mongoose.Types.ObjectId.isValid(productId)) {
        throw new CustomError("InvalidObjectId", "Invalid orderId or productId", 400);
      }
  
      const order = await Order.findById(orderId).session(session);
  
      if (!order) {
        throw new CustomError("NotFound", "Order not found", 404);
      }
  
      // Verify the user owns this order
      if (order.user_id.toString() !== user_id) {
        throw new CustomError("Unauthorized", "User not authorized to modify this order", 403);
      }
  
      // Find the item being removed
      const cancelledItem = order.orderedItems.find(
        item => item.product_id.toString() === productId
      );
  
      if (!cancelledItem) {
        throw new CustomError("NotFound", "Product not found in order", 404);
      }
  
      // Filter out the item from the order
      order.orderedItems = order.orderedItems.filter(
        item => item.product_id.toString() !== productId
      );
  
      if (order.orderedItems.length === 0) {
        order.isDeleted = true;
      }
  
      await order.save({ session });
  
      const cancelledItems = [
        {
          product_id: cancelledItem.product_id,
          variant_id: cancelledItem.variant_id,
          quantity: cancelledItem.quantity,
          price_per_unit: cancelledItem.price_per_unit,
          total_price: cancelledItem.total_price,
        },
      ];
  
      // Call the appropriate cancellation service
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
  
      // You can add returned logic similarly if needed
      if (status === "Returned") {
        await createReturnedOrder({
          orderId,
          user_id,
          product_id: cancelledItem.product_id,
          variant_id: cancelledItem.variant_id,
          quantity: cancelledItem.quantity,
          price_per_unit: cancelledItem.price_per_unit,
          returnReason,
          returnImages,
        }, session);
      }
  
      await session.commitTransaction();
      session.endSession();
  
      return res.status(200).json({
        success: true,
        message: "Item removed from order and cancelled successfully",
        removedItem: cancelledItems[0],
        order,
      });
  
    } catch (err) {
      await session.abortTransaction();
      session.endSession();
      console.error("Cancel/Return with Transaction Error:", err);
      next(err instanceof CustomError ? err : new CustomError("ServerError", err.message, 500));
    }
  };

  

module.exports = {
    createOrder,
    verifyPayment,
    handleCustomerOrderAction,
    handleAdminOrderAction,
    cancelOrReturnOrderItem
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
  