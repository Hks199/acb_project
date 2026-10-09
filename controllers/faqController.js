const Faq = require('../models/Faq');
const { CustomError } = require('../errors/CustomErrorHandler');
const { validateFaq } = require('../helpers/faqValidation');
const order = { sortOrder: 1, createdAt: 1, _id: 1 };
const requireId = (id) => {
  if (typeof id !== 'string' || !/^[a-f\d]{24}$/i.test(id)) throw new CustomError('InvalidInput', 'Invalid FAQ ID.', 400);
};
const requireDocument = (document) => {
  if (!document) throw new CustomError('NotFound', 'FAQ not found.', 404);
  return document;
};
exports.getActive = async (req, res, next) => {
  try {
    const rows = await Faq.find({ isActive: true }).select('question answer sortOrder').sort(order).lean();
    res.set('Cache-Control', 'no-store');
    res.json(rows);
  } catch (error) { next(error); }
};
exports.getAll = async (req, res, next) => {
  try {
    res.set('Cache-Control', 'no-store');
    res.json(await Faq.find({}).sort(order).lean());
  } catch (error) { next(error); }
};
exports.create = async (req, res, next) => {
  try { res.status(201).json(await Faq.create(validateFaq(req.body))); }
  catch (error) { next(error); }
};
exports.update = async (req, res, next) => {
  try {
    requireId(req.params.id);
    const fields = validateFaq(req.body, true);
    const row = await Faq.findByIdAndUpdate(req.params.id, { $set: fields }, { new: true, runValidators: true });
    res.json(requireDocument(row));
  } catch (error) { next(error); }
};
exports.remove = async (req, res, next) => {
  try {
    requireId(req.params.id);
    requireDocument(await Faq.findByIdAndDelete(req.params.id));
    res.json({ success: true });
  } catch (error) { next(error); }
};
