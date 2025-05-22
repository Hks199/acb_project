const Product = require("../models/inventoryModel");
const { CustomError } = require("../errors/CustomErrorHandler.js");

// CREATE
const createProduct = async (req, res, next) => {
  try {
    const product = await Product.create(req.body);
    res.status(201).json({ success: true, product });
  } catch (error) {
    next(new CustomError("CreateProductError", error.message, 400));
  }
};

// READ ALL
const getAllProducts = async (req, res, next) => {
  try {
    const products = await Product.find().populate("category_id").populate("vendor_id");
    res.status(200).json({ success: true, products });
  } catch (error) {
    next(new CustomError("FetchProductError", error.message, 500));
  }
};

// READ ONE
const getProductById = async (req, res, next) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) return next(new CustomError("NotFound", "Product not found", 404));
    res.status(200).json({ success: true, product });
  } catch (error) {
    next(new CustomError("FetchProductError", error.message, 500));
  }
};

// UPDATE
const updateProduct = async (req, res, next) => {
  try {
    const product = await Product.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });
    if (!product) return next(new CustomError("NotFound", "Product not found", 404));
    res.status(200).json({ success: true, product });
  } catch (error) {
    next(new CustomError("UpdateProductError", error.message, 400));
  }
};

// DELETE
const deleteProduct = async (req, res, next) => {
  try {
    const product = await Product.findByIdAndDelete(req.params.id);
    if (!product) return next(new CustomError("NotFound", "Product not found", 404));
    res.status(200).json({ success: true, message: "Product deleted successfully." });
  } catch (error) {
    next(new CustomError("DeleteProductError", error.message, 500));
  }
};

module.exports = {
  createProduct,
  getAllProducts,
  getProductById,
  updateProduct,
  deleteProduct,
};
