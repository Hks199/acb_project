const Product = require('../models/inventoryModel');
const ProductVariantSet = require('../models/variantModel');
const TshirtOffer = require('../models/tshirtOfferModel');
const Promotion = require('../models/promotionModel');
const Discount = require('../models/discountModel');
const Order = require('../models/orderModel');
const mongoose = require('mongoose');
const { CustomError } = require('../errors/CustomErrorHandler');
const { calculatePricing } = require('./calculatePricing');

const quoteOrder = async (orderedItems, userId, { checkStock = true } = {}) => {
  if (!Array.isArray(orderedItems) || !orderedItems.length) throw new CustomError('BadRequest', 'No ordered items provided', 400);
  const resolved = [];
  const productCache = new Map();
  const productCounts = new Map();
  const variantCounts = new Map();
  for (const item of orderedItems) {
    if (!mongoose.Types.ObjectId.isValid(item.product_id) || !Number.isSafeInteger(item.quantity) || item.quantity < 1) {
      throw new CustomError('BadRequest', 'Invalid ordered item', 400);
    }
    const id = String(item.product_id);
    if (!productCache.has(id)) {
      const product = await Product.findById(item.product_id);
      const variants = await ProductVariantSet.findOne({ productId: item.product_id });
      productCache.set(id, { product, variants });
    }
    const { product, variants } = productCache.get(id);
    if (!product) throw new CustomError('NotFound', 'Product not found', 404);
    const total = (productCounts.get(id) || 0) + item.quantity;
    productCounts.set(id, total);
    if (checkStock && (product.isActive === false || !(Number(product.stock) >= total))) {
      throw new CustomError('OutOfStock', 'Product unavailable', 400);
    }
    const variant = variants?.combinations.find((combination) => String(combination._id) === String(item.variant_combination_id));
    if ((variants || item.variant_combination_id) && !variant) throw new CustomError('OutOfStock', 'Product unavailable', 400);
    if (variant) {
      const key = `${id}:${variant._id}`;
      const variantTotal = (variantCounts.get(key) || 0) + item.quantity;
      variantCounts.set(key, variantTotal);
      if (checkStock && !(Number(variant.stock) >= variantTotal)) throw new CustomError('OutOfStock', 'Product unavailable', 400);
    }
    const unitPrice = Number(variant ? variant.price : product.price);
    if (!Number.isFinite(unitPrice) || unitPrice < 0) throw new CustomError('InvalidPrice', 'Product price is unavailable', 400);
    resolved.push({ productId: id, variantId: variant ? String(variant._id) : null, quantity: item.quantity, unitPrice });
  }
  const now = new Date();
  const [offer, promotions, discount, previousOrder] = await Promise.all([
    TshirtOffer.findOne({ key: 'tshirt' }).lean(),
    Promotion.find({ product_id: { $in: [...productCache.keys()] }, is_active: true,
      $and: [{ $or: [{ start_date: null }, { start_date: { $lte: now } }] },
        { $or: [{ end_date: null }, { end_date: { $gte: now } }] }] }).lean(),
    Discount.findById('69abe13c74a49e13d7b1d041'),
    userId ? Order.findOne({ user_id: userId, paymentStatus: 'Paid' }) : Promise.resolve(true),
  ]);
  return calculatePricing({ items: resolved, offer, promotions, discount, isFirstOrder: !previousOrder });
};

module.exports = { quoteOrder };
