const DiscountRule = require('../models/DiscountRule');
const { ensureDiscountRules, validateRuleUpdate } = require('../helpers/discountRules');
const { CustomError } = require('../errors/CustomErrorHandler');

exports.getAll = async (req, res, next) => {
  try {
    await ensureDiscountRules();
    const rules = await DiscountRule.find({}).sort({ ruleKey: 1 }).lean();
    res.json({ success: true, rules });
  } catch (error) { next(error); }
};

exports.update = async (req, res, next) => {
  try {
    const update = validateRuleUpdate(req.params.ruleKey, req.body);
    await ensureDiscountRules();
    const rule = await DiscountRule.findOneAndUpdate({ ruleKey: req.params.ruleKey }, { $set: update }, { new: true, runValidators: true });
    if (!rule) throw new CustomError('NotFound', 'Discount rule not found', 404);
    res.json({ success: true, rule });
  } catch (error) { next(error); }
};
