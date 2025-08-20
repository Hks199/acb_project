const Order = require("../models/orderModel");
const razorpay = require("../helpers/razorpayInstance");
const Product = require("../models/inventoryModel");
const { CustomError } = require("../errors/CustomErrorHandler.js");
const crypto = require("crypto");
const {createOrUpdateCancelledOrder} = require("./cancelOrderController.js")
const {createReturnedOrder} = require("./returnOrderController.js")
const {updateProductsStock} = require("./inventroryController.js");
const {updateVariantsStock} = require("./variantController.js")
const mongoose = require("mongoose");
const {generateOrderId} = require("../helpers/generateOrderId.js");

const createOrder = async (req, res, next) => {
  const session = await mongoose.startSession();
  try {
    // Validate orderedItems before starting transaction
    const { orderedItems } = req.body;
    if (!Array.isArray(orderedItems) || orderedItems.length === 0) {
      throw new CustomError("No ordered items provided", 400);
    }
      for (const item of orderedItems) {
      if (
        !item.product_id ||
        !mongoose.Types.ObjectId.isValid(item.product_id) ||
        typeof item.quantity !== "number" ||
        item.quantity <= 0
      ) {
        throw new CustomError(`Invalid ordered item detected: ${JSON.stringify(item)}`, 400);
      }
      // Check if product exists
      const productExists = await mongoose.model("Product").exists({ _id: item.product_id });
        if (!productExists) {
        throw new CustomError(`Product not found: ${item.product_id}`, 404);
      }
      const product = await Product.findById(item.product_id).session(session);
        if (!product) {
        throw new CustomError(`Product not found: ${item.product_id}`, 404);
      }
    
      if(product.stock < item.quantity) {
          throw new CustomError(`Insufficient stock for product: ${item.product_id}`, 400);
      }
      
    }

    session.startTransaction();
    const {
      user_id,
      shippingAddress,
      paymentMethod,
      subtotal,
      tax = 0,
      deliveryCharge = 0,
    } = req.body;
    let order_number = await generateOrderId();
    const totalAmount = subtotal + tax + deliveryCharge;

    // Step 1: Create Razorpay order
    const razorpayOrder = await razorpay.orders.create({
      amount: totalAmount * 100, // paise
      currency: "INR",
      receipt: `receipt_${Date.now()}`,
    });

    // Step 2: Save order in DB inside transaction
    const order = await Order.create(
      [
        {
          user_id,
          order_number,
          orderedItems,
          shippingAddress,
          paymentMethod,
          subtotal,
          tax,
          deliveryCharge,
          totalAmount,
          razorpayOrderId: razorpayOrder.id,
          currency: razorpayOrder.currency,
          currency: "INR"
        },
      ],
      { session }
    );

    await session.commitTransaction();
    session.endSession();

    res.status(201).json({
      success: true,
      // order: order[0], // created via array
      razorpayOrder: {
        id: razorpayOrder.id,
        amount: razorpayOrder.amount/100,
        currency: razorpayOrder.currency,
      },
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


// const verifyPayment = async (req, res, next) => {
//   try {
//     const { razorpay_payment_id, razorpay_order_id, razorpay_signature } = req.body;

//     const generated_signature = crypto
//       .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
//       .update(`${razorpay_order_id}|${razorpay_payment_id}`)
//       .digest("hex");

//     if (generated_signature !== razorpay_signature) {
//       return next(new CustomError("SignatureMismatch", "Invalid payment signature", 400));
//     }

//     // Update order status in DB
//     const order = await Order.findOneAndUpdate(
//       { razorpayOrderId: razorpay_order_id },
//       {
//         razorpayPaymentId: razorpay_payment_id,
//         paymentStatus: "Paid",
//       },
//       { new: true }
//     );

//     if (!order) {
//       return next(new CustomError("OrderNotFound", "Order not found for verification", 404));
//     }

//       // Step 3: Update stocks using the same session
//       await updateProductsStock(order.orderedItems, session);
//       await updateVariantsStock(order.orderedItems, session);

//     res.status(200).json({
//       success: true,
//       message: "Payment verified successfully",
//       order,
//     });
//   } catch (error) {
//     next(new CustomError("PaymentVerificationError", error.message, 500));
//   }
// };

const verifyPayment = async (req, res, next) => {
  const session = await mongoose.startSession();
  
  try {
    session.startTransaction();
    
    const { razorpay_payment_id, razorpay_order_id, razorpay_signature } = req.body;

    // Step 1: Verify signature
    const generated_signature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest("hex");

    if (generated_signature !== razorpay_signature) {
      await session.abortTransaction();
      session.endSession();
      return next(new CustomError("SignatureMismatch", "Invalid payment signature", 400));
    }

    // Step 2: Update order status
    const order = await Order.findOneAndUpdate(
      { razorpayOrderId: razorpay_order_id },
      {
        razorpayPaymentId: razorpay_payment_id,
        paymentStatus: "Paid"
      },
      { new: true, session }
    );

    if (!order) {
      await session.abortTransaction();
      session.endSession();
      return next(new CustomError("OrderNotFound", "Order not found for verification", 404));
    }

    // Step 3: Update stock within the same transaction
    await updateProductsStock(order.orderedItems, session);
    await updateVariantsStock(order.orderedItems, session);

    // Commit transaction
    await session.commitTransaction();
    session.endSession();

    res.status(200).json({
      success: true,
      message: "Payment verified successfully",
      order,
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    next(new CustomError("PaymentVerificationError", error.message, 500));
  }
};

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
          ? returnImages.map(img => img)
          : returnImages ? [returnImages] : [];
  
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
            paymentStatus: "Paid",
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
  

  const listAllOrders = async (req, res, next) => {
    try {
      const {limit=10,page=1} = req.body;
      const skip = (page - 1) * limit;
  
      const pipeline = [
        { 
          $match: { 
          isDeleted: false,
          paymentStatus: "Paid",
          }
        },
        // Unwind orderedItems to flatten
        { $unwind: "$orderedItems" },
  
        // Lookup Product
        {
          $lookup: {
            from: "products",
            localField: "orderedItems.product_id",
            foreignField: "_id",
            as: "product",
          },
        },
        { $unwind: { path: "$product", preserveNullAndEmptyArrays: true } },
    
        // Lookup Variant (if any)
        {
          $lookup: {
            from: "productvariantsets",
            localField: "orderedItems.variant_combination_id",
            foreignField: "combinations._id",
            as: "variantSet",
          },
        },
        {
          $unwind: { path: "$variantSet", preserveNullAndEmptyArrays: true },
        },
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
  
        // Lookup User Info
        {
          $lookup: {
            from: "users",
            localField: "user_id",
            foreignField: "_id",
            as: "user",
          },
        },
        { $unwind: { path: "$user", preserveNullAndEmptyArrays: true } },
  
        // Final projection
        {
          $project: {
            order_id: "$_id",
            user_id: 1,
            order_number : 1,
            name : "$user.first_name",
            // product: {
              // _id: "$product._id",
              // name: "$product.product_name",
              // image: { $arrayElemAt: ["$product.imageUrls", 0] },
            // },
            // variant_combination: 1,
            quantity: "$orderedItems.quantity",
            price_per_unit: "$orderedItems.price_per_unit",
            total_price: "$orderedItems.total_price",
            // shippingAddress: 1,
            // paymentMethod: 1,
            // paymentStatus: 1,
            orderStatus: 1,
            // subtotal: 1,
            // deliveryCharge: 1,
            totalAmount: 1,
            shippedAt: 1,
            deliveredAt: 1,
            createdAt: 1,
          },
        },
  
        { $sort: { createdAt: -1 } },
        { $skip: skip },
        { $limit: limit },
      ];
  
      const orders = await mongoose.model("Order").aggregate(pipeline);
  
      const totalCount = await mongoose.model("Order").countDocuments({ isDeleted: false });
  
      res.status(200).json({
        success: true,
        totalOrders: totalCount,
        currentPage: page,
        totalPages: Math.ceil(totalCount / limit),
        data: orders,
      });
    } catch (error) {
      next(
        error instanceof CustomError
          ? error
          : new CustomError("ListOrdersError", error.message, 500)
      );
    }
  };
  


  
  const getOrderDetails = async (req, res, next) => {
    try {
      const { orderId } = req.body;
  
      if (!mongoose.Types.ObjectId.isValid(orderId)) {
        return next(new CustomError("Invalid Order ID", 400));
      }
  
      const pipeline = [
        { $match: { _id: new mongoose.Types.ObjectId(orderId), isDeleted: false } },
  
        { $unwind: "$orderedItems" },
  
        // Lookup product details
        {
          $lookup: {
            from: "products",
            localField: "orderedItems.product_id",
            foreignField: "_id",
            as: "product",
          },
        },
        { $unwind: { path: "$product", preserveNullAndEmptyArrays: true } },
  
        // Lookup variant combination
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
  
        {
          $group: {
            _id: "$_id",
            user_id: { $first: "$user_id" },
            order_number : {$first : "$order_number"},
            shippingAddress: { $first: "$shippingAddress" },
            paymentMethod: { $first: "$paymentMethod" },
            paymentStatus: { $first: "$paymentStatus" },
            orderStatus: { $first: "$orderStatus" },
            subtotal: { $first: "$subtotal" },
            tax: { $first: "$tax" },
            deliveryCharge: { $first: "$deliveryCharge" },
            totalAmount: { $first: "$totalAmount" },
            razorpayOrderId: { $first: "$razorpayOrderId" },
            currency: { $first: "$currency" },
            shippedAt: { $first: "$shippedAt" },
            deliveredAt: { $first: "$deliveredAt" },
            createdAt: { $first: "$createdAt" },
            orderedItems: {
              $push: {
                product_id: "$orderedItems.product_id",
                quantity: "$orderedItems.quantity",
                price_per_unit: "$orderedItems.price_per_unit",
                total_price: "$orderedItems.total_price",
                product_name: "$product.product_name",
                product_images: "$product.imageUrls",
                variant_combination: "$variant_combination",
              },
            },
          },
        },
  
        {
          $project: {
            _id: 0,
            order_id: "$_id",
            user_id: 1,
            order_number : 1, 
            shippingAddress: 1,
            paymentMethod: 1,
            paymentStatus: 1,
            orderStatus: 1,
            subtotal: 1,
            tax: 1,
            deliveryCharge: 1,
            totalAmount: 1,
            razorpayOrderId: 1,
            currency: 1,
            shippedAt: 1,
            deliveredAt: 1,
            createdAt: 1,
            orderedItems: 1,
          },
        },
      ];
  
      const result = await Order.aggregate(pipeline);
  
      if (!result.length) {
        return next(new CustomError("Order not found", 404));
      }
  
      res.status(200).json({
        success: true,
        message: "Order details fetched successfully",
        data: result[0], // single order object
      });
    } catch (err) {
      next(new CustomError("OrderDetailsError", err.message, 500));
    }
  };
    
  
  const generateOrderBill = async (req, res, next) => {
    try {
      const { orderId } = req.body;
  
      if (!mongoose.Types.ObjectId.isValid(orderId)) {
        return next(new CustomError("Invalid Order ID", 400));
      }
  
      const order = await Order.findById(orderId)
        .populate("user_id", "first_name email phone")
        .populate("orderedItems.product_id", "product_name imageUrls")
        .lean();
  
      if (!order) {
        return next(new CustomError("Order not found", 404));
      }
  
      // Format bill
      const bill = {
        invoiceNumber: `INV-${order.order_number.split("-")[1]}`,
        orderDate: new Date(order.createdAt).toLocaleString(),
        customer: {
          name: order.user_id.name,
          email: order.user_id.email,
          phone: order.user_id.phone,
          shippingAddress: order.shippingAddress,
        },
        payment: {
          method: order.paymentMethod,
          status: order.paymentStatus,
          currency: order.currency,
        },
        items: order.orderedItems.map((item, index) => ({
          srNo: index + 1,
          productName: item.product_id.product_name,
          image: item.product_id.imageUrls?.[0] || null,
          vendor: item.vendor_id.name,
          quantity: item.quantity,
          unitPrice: item.price_per_unit,
          total: item.total_price,
        })),
        charges: {
          subtotal: order.subtotal,
          tax: order.tax,
          deliveryCharge: order.deliveryCharge,
          totalAmount: order.totalAmount,
        },
        status: {
          orderStatus: order.orderStatus,
          shippedAt: order.shippedAt,
          deliveredAt: order.deliveredAt,
        },
      };
  
      return res.status(200).json({
        success: true,
        message: "Order bill generated successfully",
        bill,
      });
    } catch (error) {
      next(new CustomError("GenerateBillError", error.message, 500));
    }
  };
  
  
  

module.exports = {
    createOrder,
    verifyPayment,
    // handleCustomerOrderAction,
    handleAdminOrderAction,
    cancelOrReturnOrderItem,
    getUserOrderedProducts,
    listAllOrders,
    getOrderDetails,
    generateOrderBill

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
  