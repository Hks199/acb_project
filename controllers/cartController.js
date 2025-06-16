const Cart = require("../models/cartModel");
const { CustomError } = require("../errors/CustomErrorHandler.js");

const addToCart = async (req, res, next) => {
  try {
    const { user_id, product_id, variant_id, quantity } = req.body;

    if (!user_id || !product_id || quantity < 1) {
      return next(new CustomError("BadRequest", "user_id, product_id, and quantity required", 400));
    }

    let cart = await Cart.findOne({ user_id });

    if (!cart) {
      cart = await Cart.create({
        user_id,
        items: [{ product_id, variant_id, quantity }],
      });
    } else {
      const existingItem = cart.items.find(
        (item) =>
          item.product_id.toString() === product_id &&
          (variant_id ? item.variant_id?.toString() === variant_id : !item.variant_id)
      );

      if (existingItem) {
        existingItem.quantity += quantity;
      } else {
        cart.items.push({ product_id, variant_id, quantity });
      }

      await cart.save();
    }

    res.status(200).json({ success: true, cart });
  } catch (error) {
    next(new CustomError("AddToCartError", error.message, 500));
  }
};

const getCart = async (req, res, next) => {
  try {
    const { user_id } = req.query;

    if (!user_id) return next(new CustomError("BadRequest", "user_id is required", 400));

    const cart = await Cart.findOne({ user_id })
      .populate("items.product_id", "product_name price imageUrls")
      .populate("items.variant_id", "variant_attributes price");

    if (!cart) return next(new CustomError("NotFound", "Cart is empty", 404));

    res.status(200).json({ success: true, cart });
  } catch (error) {
    next(new CustomError("GetCartError", error.message, 500));
  }
};

const updateCartItem = async (req, res, next) => {
  try {
    const { user_id, product_id, variant_id, quantity } = req.body;

    if (!user_id || !product_id || quantity < 1) {
      return next(new CustomError("BadRequest", "Missing or invalid fields", 400));
    }

    const cart = await Cart.findOne({ user_id });
    if (!cart) return next(new CustomError("NotFound", "Cart not found", 404));

    const item = cart.items.find(
      (item) =>
        item.product_id.toString() === product_id &&
        (variant_id ? item.variant_id?.toString() === variant_id : !item.variant_id)
    );

    if (!item) return next(new CustomError("NotFound", "Item not in cart", 404));

    item.quantity = quantity;
    await cart.save();

    res.status(200).json({ success: true, message: "Item updated", cart });
  } catch (error) {
    next(new CustomError("UpdateCartError", error.message, 500));
  }
};

const removeCartItem = async (req, res, next) => {
  try {
    const { user_id, product_id, variant_id } = req.body;

    if (!user_id || !product_id) {
      return next(new CustomError("BadRequest", "user_id and product_id required", 400));
    }

    const cart = await Cart.findOne({ user_id });
    if (!cart) return next(new CustomError("NotFound", "Cart not found", 404));

    cart.items = cart.items.filter(
      (item) =>
        !(
          item.product_id.toString() === product_id &&
          (variant_id ? item.variant_id?.toString() === variant_id : !item.variant_id)
        )
    );

    await cart.save();
    res.status(200).json({ success: true, message: "Item removed", cart });
  } catch (error) {
    next(new CustomError("RemoveItemError", error.message, 500));
  }
};

const clearCart = async (req, res, next) => {
  try {
    const { user_id } = req.body;

    if (!user_id) return next(new CustomError("BadRequest", "user_id required", 400));

    const cart = await Cart.findOne({ user_id });
    if (!cart) return next(new CustomError("NotFound", "Cart not found", 404));

    cart.items = [];
    await cart.save();

    res.status(200).json({ success: true, message: "Cart cleared" });
  } catch (error) {
    next(new CustomError("ClearCartError", error.message, 500));
  }
};

const calculateCartTotalAmount = async (req, res, next) => {
  try {
    const userId = req.params.userId || req.user?._id;

    if (!userId) {
      throw new CustomError("User ID is required", 400);
    }

    const result = await Cart.aggregate([
      { $match: { user_id: new mongoose.Types.ObjectId(userId) } },
      { $unwind: "$items" },

      // Lookup variant
      {
        $lookup: {
          from: "variants",
          localField: "items.variant_id",
          foreignField: "_id",
          as: "variant",
        },
      },
      {
        $unwind: {
          path: "$variant",
          preserveNullAndEmptyArrays: true,
        },
      },

      // Lookup product
      {
        $lookup: {
          from: "products",
          localField: "items.product_id",
          foreignField: "_id",
          as: "product",
        },
      },
      { $unwind: "$product" },

      // Determine price and quantity
      {
        $addFields: {
          itemPrice: {
            $cond: {
              if: { $ifNull: ["$variant.price", false] },
              then: "$variant.price",
              else: "$product.price",
            },
          },
          quantity: "$items.quantity",
          productId: "$items.product_id",
        },
      },

      // Calculate per item total and retain productId
      {
        $project: {
          _id: 0,
          totalPerItem: { $multiply: ["$itemPrice", "$quantity"] },
          productId: 1,
        },
      },

      // Group and sum
      {
        $group: {
          _id: null,
          totalAmount: { $sum: "$totalPerItem" },
          uniqueProducts: { $addToSet: "$productId" },
        },
      },

      // Project total amount and count of unique items
      {
        $project: {
          _id: 0,
          totalAmount: 1,
          uniqueItemCount: { $size: "$uniqueProducts" },
        },
      },
    ]);

    const totalAmount = result[0]?.totalAmount || 0;
    const uniqueItemCount = result[0]?.uniqueItemCount || 0;

    res.status(200).json({
      success: true,
      totalAmount,
      uniqueItemCount,
    });
  } catch (error) {
    next(
      error instanceof CustomError
        ? error
        : new CustomError(error.message, 500)
    );
  }
};

module.exports = {
  addToCart,
  getCart,
  updateCartItem,
  removeCartItem,
  clearCart,
  calculateCartTotalAmount
};

