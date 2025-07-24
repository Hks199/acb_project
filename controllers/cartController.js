const Cart = require("../models/cartModel");
const { CustomError } = require("../errors/CustomErrorHandler.js");
const mongoose = require("mongoose");
const Product = require("../models/inventoryModel.js");
const ProductVariantSet = require("../models/variantModel.js");


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

    res.status(200).json({ success: true,message:"submited successfully"});
  } catch (error) {
    next(new CustomError("AddToCartError", error.message, 500));
  }
};



const getCart = async (req, res, next) => {
  const session = await mongoose.startSession();

  try {
    session.startTransaction();

    const { user_id } = req.params;
    if (!user_id) {
      await session.abortTransaction();
      return next(new CustomError("BadRequest", "user_id is required", 400));
    }

    const cart = await Cart.findOne({ user_id }).lean().session(session);
    if (!cart || cart.items.length === 0) {
      await session.abortTransaction();
      return next(new CustomError("NotFound", "Cart is empty", 404));
    }

    const detailedItems = await Promise.all(
      cart.items.map(async (item) => {
        const product = await Product.findById(item.product_id)
          .select("product_name price imageUrls")
          .session(session);

        const variantSet = await ProductVariantSet.findOne({
          productId: item.product_id,
          "combinations._id": new mongoose.Types.ObjectId(item.variant_id),
        }).session(session);

        let variantDetails = null;

        if (variantSet) {
          variantDetails = variantSet.combinations.find(
            (comb) => comb._id.toString() === item.variant_id.toString()
          );
        }

        return {
          product: {
            _id: product?._id,
            name: product?.product_name,
            image: product?.imageUrls?.[0],
          },
          quantity: item.quantity,
          variant: variantDetails || null,
          fallback_price: product?.price || 0,
        };
      })
    );

    await session.commitTransaction();
    session.endSession();

    return res.status(200).json({
      success: true,
      cart: {
        _id: cart._id,
        user_id: cart.user_id,
        items: detailedItems,
      },
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    next(new CustomError("GetCartError", error.message, 500));
  }
};

const updateCartItem = async (req, res, next) => {
  try {
    const { user_id, product_id, variant_id, quantity } = req.body;

    // Basic validations
    if (!user_id || !product_id || quantity == null || quantity < 1) {
      return next(new CustomError("BadRequest", "Missing or invalid fields", 400));
    }

    // Ensure ObjectId format
    const userIdObj = new mongoose.Types.ObjectId(user_id);
    const productIdObj = new mongoose.Types.ObjectId(product_id);
    const variantIdObj = variant_id ? new mongoose.Types.ObjectId(variant_id) : null;

    const cart = await Cart.findOne({ user_id: userIdObj });
    if (!cart) return next(new CustomError("NotFound", "Cart not found", 404));

    // Find item by product & variant (if any)
    const item = cart.items.find((item) => {
      const isSameProduct = item.product_id.toString() === productIdObj.toString();
      const isSameVariant = variantIdObj
        ? item.variant_id?.toString() === variantIdObj.toString()
        : !item.variant_id;
      return isSameProduct && isSameVariant;
    });

    if (!item) {
      return next(new CustomError("NotFound", "Item not found in cart", 404));
    }

    // Update quantity
    item.quantity = quantity;
    await cart.save();

    return res.status(200).json({
      success: true,
      message: "Cart item updated successfully",
    });
  } catch (error) {
    next(new CustomError("UpdateCartError", error.message, 500));
  }
};


const removeCartItem = async (req, res, next) => {
  try {
    const { user_id, product_id, variant_id } = req.body;

    if (!user_id || !product_id) {
      return next(new CustomError("BadRequest", "user_id and product_id are required", 400));
    }

    const userIdObj = new mongoose.Types.ObjectId(user_id);
    const productIdObj = new mongoose.Types.ObjectId(product_id);
    const variantIdObj = variant_id ? new mongoose.Types.ObjectId(variant_id) : null;

    const cart = await Cart.findOne({ user_id: userIdObj });
    if (!cart) return next(new CustomError("NotFound", "Cart not found", 404));

    const originalLength = cart.items.length;

    cart.items = cart.items.filter((item) => {
      const isSameProduct = item.product_id.toString() === productIdObj.toString();
      const isSameVariant = variantIdObj
        ? item.variant_id?.toString() === variantIdObj.toString()
        : !item.variant_id;

      return !(isSameProduct && isSameVariant);
    });

    // Check if any item was removed
    if (cart.items.length === originalLength) {
      return next(new CustomError("NotFound", "Cart item not found", 404));
    }

    await cart.save();

    res.status(200).json({
      success: true,
      message: "Cart item removed successfully",
      cart,
    });
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

const clearCartAfterPurchase = async(user_id,session)=>{

  const cart = await Cart.findOne({ user_id }).session(session);

  cart.items = [];
  await cart.save({ session }); // ensure cart update is part of the transaction
}


 // if needed for ObjectId validation

const calculateCartTotalAmount = async (req, res, next) => {
  try {
    const userId = req.params.userId || req.user?._id;

    if (!userId) {
      throw new CustomError("User ID is required", 400);
    }

    const result = await Cart.aggregate([
      { $match: { user_id: new mongoose.Types.ObjectId(userId) } },
      { $unwind: "$items" },

      // Lookup variantSet
      {
        $lookup: {
          from: "productvariantsets",
          localField: "items.product_id",
          foreignField: "productId",
          as: "variantSet"
        }
      },
      { $unwind: { path: "$variantSet", preserveNullAndEmptyArrays: true } },

      // Get the matched combination object by _id (items.variant_id)
      {
        $addFields: {
          matchedCombination: {
            $arrayElemAt: [
              {
                $filter: {
                  input: "$variantSet.combinations",
                  as: "combo",
                  cond: { $eq: ["$$combo._id", "$items.variant_id"] }
                }
              },
              0
            ]
          }
        }
      },

      // Lookup product
      {
        $lookup: {
          from: "products",
          localField: "items.product_id",
          foreignField: "_id",
          as: "product"
        }
      },
      { $unwind: "$product" },

      // Add item price from combination or fallback to product
      {
        $addFields: {
          itemPrice: {
            $cond: {
              if: { $ifNull: ["$matchedCombination.price", false] },
              then: "$matchedCombination.price",
              else: "$product.price"
            }
          },
          quantity: "$items.quantity",
          productId: "$items.product_id"
        }
      },

      // Compute item total
      {
        $project: {
          _id: 0,
          totalPerItem: { $multiply: ["$itemPrice", "$quantity"] },
          productId: 1
        }
      },

      // Group to calculate total
      {
        $group: {
          _id: null,
          totalAmount: { $sum: "$totalPerItem" },
          uniqueProducts: { $addToSet: "$productId" }
        }
      },

      // Final output
      {
        $project: {
          _id: 0,
          totalAmount: 1,
          uniqueItemCount: { $size: "$uniqueProducts" }
        }
      }
    ]);

    const totalAmount = result[0]?.totalAmount || 0;
    const uniqueItemCount = result[0]?.uniqueItemCount || 0;

    res.status(200).json({
      success: true,
      totalAmount,
      uniqueItemCount
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
  clearCartAfterPurchase,
  calculateCartTotalAmount
};

