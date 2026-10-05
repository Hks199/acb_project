const mongoose = require('mongoose');
const TshirtOffer = require('../models/tshirtOfferModel');
const ProductVariantSet = require('../models/variantModel');
const { CustomError } = require('../errors/CustomErrorHandler');

const defaults = { enabled: false, minimumQuantity: 3, unitPrice: 333, eligibleProductIds: [], combineProducts: true, stackDiscounts: false };
const getTshirtOffer = async (req, res, next) => {
  try {
    const offer = await TshirtOffer.findOne({ key: 'tshirt' }).lean();
    res.json({ success: true, offer: offer || defaults });
  } catch (error) { next(error); }
};

const saveTshirtOffer = async (req, res, next) => {
  try {
    const { enabled, minimumQuantity, unitPrice, eligibleProductIds, combineProducts, stackDiscounts } = req.body;
    if (typeof enabled !== 'boolean' || typeof combineProducts !== 'boolean' || typeof stackDiscounts !== 'boolean' ||
        !Number.isSafeInteger(minimumQuantity) || minimumQuantity < 1 || typeof unitPrice !== 'number' ||
        !Number.isFinite(unitPrice) || unitPrice <= 0 || Math.abs(unitPrice * 100 - Math.round(unitPrice * 100)) > 1e-7 ||
        !Array.isArray(eligibleProductIds) || eligibleProductIds.some((id) => !mongoose.Types.ObjectId.isValid(id))) {
      throw new CustomError('BadRequest', 'Enter a valid quantity, price, and eligible T-shirt products.', 400);
    }
    const ids = [...new Set(eligibleProductIds)];
    if (enabled && !ids.length) throw new CustomError('BadRequest', 'Select at least one T-shirt product before enabling the offer.', 400);
    const variants = await ProductVariantSet.find({ productId: { $in: ids } }).select('productId').lean();
    if (ids.some((id) => !variants.some((variant) => String(variant.productId) === id))) {
      throw new CustomError('BadRequest', 'Only products with variants can be selected for the T-shirt offer.', 400);
    }
    const offer = await TshirtOffer.findOneAndUpdate({ key: 'tshirt' }, {
      $set: { enabled, minimumQuantity, unitPrice, eligibleProductIds: ids, combineProducts, stackDiscounts },
    }, { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true });
    res.json({ success: true, offer });
  } catch (error) { next(error); }
};

module.exports = { getTshirtOffer, saveTshirtOffer };
