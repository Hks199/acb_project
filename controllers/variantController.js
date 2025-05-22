const Variant = require("../models/variantModel.js");
const { CustomError } = require("../errors/CustomErrorHandler.js"); // adjust path as per your structure

// CREATE
const createVariant = async (req, res, next) => {
  try {
    const variant = await Variant.create(req.body);
    res.status(201).json({ success: true, variant });
  } catch (error) {
    next(new CustomError("CreateVariantError", error.message, 400));
  }
};

// READ ALL
const getAllVariants = async (req, res, next) => {
  try {
    const variants = await Variant.find().populate("product_id");
    res.status(200).json({ success: true, variants });
  } catch (error) {
    next(new CustomError("FetchVariantError", error.message, 500));
  }
};

// READ ONE
const getVariantById = async (req, res, next) => {
  try {
    const variant = await Variant.findById(req.params.id).populate("product_id");
    if (!variant) return next(new CustomError("NotFound", "Variant not found", 404));
    res.status(200).json({ success: true, variant });
  } catch (error) {
    next(new CustomError("FetchVariantError", error.message, 500));
  }
};

// UPDATE
const updateVariant = async (req, res, next) => {
  try {
    const variant = await Variant.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });
    if (!variant) return next(new CustomError("NotFound", "Variant not found", 404));
    res.status(200).json({ success: true, variant });
  } catch (error) {
    next(new CustomError("UpdateVariantError", error.message, 400));
  }
};

// DELETE
const deleteVariant = async (req, res, next) => {
  try {
    const variant = await Variant.findByIdAndDelete(req.params.id);
    if (!variant) return next(new CustomError("NotFound", "Variant not found", 404));
    res.status(200).json({ success: true, message: "Variant deleted successfully." });
  } catch (error) {
    next(new CustomError("DeleteVariantError", error.message, 500));
  }
};

module.exports = {
  createVariant,
  getAllVariants,
  getVariantById,
  updateVariant,
  deleteVariant,
};
