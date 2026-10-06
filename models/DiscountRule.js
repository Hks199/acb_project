const mongoose = require('mongoose');

const schema = new mongoose.Schema({
  ruleKey: { type: String, required: true, unique: true, enum: ['first_order_discount', 'milestone_discount'] },
  ruleName: { type: String, required: true, trim: true, maxlength: 120 },
  discountPercentage: { type: Number, required: true, default: 0, min: 0, max: 100 },
  minPurchaseAmount: { type: Number, default: null, min: 0 },
  isActive: { type: Boolean, required: true, default: false },
}, { timestamps: true, collection: 'discount_rules' });

module.exports = mongoose.model('DiscountRule', schema);
