const Product = require("../models/inventoryModel");
const ProductVariantSet = require("../models/variantModel");
const { CustomError } = require("../errors/CustomErrorHandler");

const validateCartStock = async (items, productId, variantId, quantity) => {
  const product = await Product.findById(productId);
  if (!product) {
    throw new CustomError("NotFound", "Product not found", 404);
  }

  // Product stock is shared by all size/color combinations in the cart.
  const otherQuantity = items.reduce((total, item) => {
    const sameProduct = item.product_id.toString() === productId.toString();
    const sameVariant = variantId
      ? item.variant_id?.toString() === variantId.toString()
      : !item.variant_id;
    return total + (sameProduct && !sameVariant ? item.quantity : 0);
  }, 0);
  let available = Math.max(0, product.stock - otherQuantity);

  if (variantId) {
    const variantSet = await ProductVariantSet.findOne({
      productId,
      "combinations._id": variantId,
    });
    const variant = variantSet?.combinations.find(
      (combination) => combination._id.toString() === variantId.toString()
    );
    if (!variant) {
      throw new CustomError("NotFound", "Selected variant not found", 404);
    }
    available = Math.min(available, variant.stock);
  }

  if (quantity > available) {
    throw new CustomError(
      "OutOfStock",
      `Only ${available} ${available === 1 ? "unit is" : "units are"} available for ${product.product_name}${variantId ? " in the selected size/color" : ""}.`,
      400
    );
  }
};

module.exports = { validateCartStock };
