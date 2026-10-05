const mongoose = require('mongoose');

const schema = new mongoose.Schema({
  key: { type: String, default: 'tshirt', unique: true, immutable: true },
  enabled: { type: Boolean, default: false },
  minimumQuantity: { type: Number, default: 3, min: 1, validate: Number.isSafeInteger },
  unitPrice: { type: Number, default: 333, min: 0.01 },
  eligibleProductIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Product' }],
  combineProducts: { type: Boolean, default: true },
  stackDiscounts: { type: Boolean, default: false },
}, { timestamps: true });

module.exports = mongoose.model('TshirtOffer', schema);
