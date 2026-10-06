const DiscountRule = require('../models/DiscountRule');
const { CustomError } = require('../errors/CustomErrorHandler');

const defaults = [
  { ruleKey: 'first_order_discount', ruleName: 'First Customer Order Discount', discountPercentage: 10, minPurchaseAmount: null, isActive: true },
  { ruleKey: 'milestone_discount', ruleName: 'High Value Order Additional Discount', discountPercentage: 5, minPurchaseAmount: 4999, isActive: true },
];

// Only seed missing rules. Never overwrite an administrator's saved configuration.
let initialization;
const ensureDiscountRules = () => {
  if (!initialization) {
    initialization = Promise.all(defaults.map(async (rule) => {
      try {
        await DiscountRule.updateOne({ ruleKey: rule.ruleKey }, { $setOnInsert: rule }, { upsert: true });
      } catch (error) {
        // Another server process may have inserted the same unique key first.
        if (error.code !== 11000) throw error;
      }
    })).catch((error) => { initialization = undefined; throw error; });
  }
  return initialization;
};

const getActiveDiscountRules = async () => {
  await ensureDiscountRules();
  // Read on every quote so saving a rule takes effect on the next calculation.
  return DiscountRule.find({ isActive: true }).lean();
};

const validateRuleUpdate = (key, body) => {
  if (!defaults.some((rule) => rule.ruleKey === key)) throw new CustomError('NotFound', 'Discount rule not found', 404);
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new CustomError('BadRequest', 'Invalid discount rule', 400);
  const update = {};
  for (const field of Object.keys(body)) {
    if (!['discountPercentage', 'minPurchaseAmount', 'isActive'].includes(field)) {
      throw new CustomError('BadRequest', `Cannot update ${field}`, 400);
    }
    const value = body[field];
    if (field === 'isActive') {
      if (typeof value !== 'boolean') throw new CustomError('BadRequest', 'Status must be true or false', 400);
    } else if (!(field === 'minPurchaseAmount' && value === null)) {
      const maximum = field === 'discountPercentage' ? 100 : Number.MAX_SAFE_INTEGER / 100;
      if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > maximum
        || Math.abs(value * 100 - Math.round(value * 100)) > 0.000001) {
        throw new CustomError('BadRequest', `${field} must be a non-negative number with at most two decimal places${field === 'discountPercentage' ? ' between 0 and 100' : ''}`, 400);
      }
    }
    update[field] = value;
  }
  if (!Object.keys(update).length) throw new CustomError('BadRequest', 'Provide a setting to update', 400);
  return update;
};

module.exports = { ensureDiscountRules, getActiveDiscountRules, validateRuleUpdate };
