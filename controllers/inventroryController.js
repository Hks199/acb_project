const Product = require("../models/inventoryModel");
const { CustomError } = require("../errors/CustomErrorHandler.js");
const {s3UploadHandler,s3DeleteHandler,s3ReplaceHandler} = require("../helpers/s3BucketUploadHandler");
// CREATE
const createProduct = async (req, res, next) => {
  try {
    const {
      category_id,
      vendor_id,
      product_name,
      description,
      price,
      stock,
      isActive
    } = req.body;

    if (!req.files || !req.files.images) {
      throw new CustomError("Product images are required", 400);
    }

    const files = Array.isArray(req.files.images)
      ? req.files.images
      : [req.files.images];

    const uploadedImages = await Promise.all(
      files.map(file => s3UploadHandler(file, "product-images"))
    );

    const imageUrls = uploadedImages.map(img => img.publicUrl);
    const imageKeys = uploadedImages.map(img => img.fileKey);

    const newProduct = new Product({
      category_id,
      vendor_id,
      product_name,
      description: JSON.parse(description), // parse if sent as string
      price,
      stock,
      imageUrls,
      imageKeys,
      isActive
    });

    await newProduct.save();

    return res.status(201).json({
      success: true,
      message: "Product created successfully",
      data: newProduct
    });
  } catch (err) {
    console.error("Create Product Error:", err);
    next(err instanceof CustomError ? err : new CustomError(err.message, 500));
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
    const { id } = req.params;
    const updateData = req.body;

    const product = await Product.findById(id);
    if (!product) return res.status(404).json({ success: false, message: "Product not found" });

    if (req.files && req.files.images) {
      const newImages = Array.isArray(req.files.images)
        ? req.files.images
        : [req.files.images];

      if (newImages.length !== product.image_keys.length) {
        return res.status(400).json({
          success: false,
          message: `Image count mismatch. Expected ${product.image_keys.length} images.`,
        });
      }

      const updatedUrls = [];

      for (let i = 0; i < newImages.length; i++) {
        const image = newImages[i];
        const fileKey = product.image_keys[i];

        const { publicUrl } = await s3ReplaceHandler(image, fileKey);
        updatedUrls.push(publicUrl);
      }

      updateData.imageUrls = updatedUrls;
    }

    const updatedProduct = await Product.findByIdAndUpdate(id, updateData, { new: true });

    res.status(200).json({
      success: true,
      message: "Product updated successfully",
      data: updatedProduct,
    });

  } catch (err) {
    console.error("Update Product Error:", err);
    next(err);
  }
};

// DELETE
const deleteProduct = async (req, res, next) => {
  try {
    const { id } = req.params;

    const product = await Product.findById(id);
    if (!product) return res.status(404).json({ success: false, message: "Product not found" });

    // Delete all images from S3
    for (const key of product.image_keys) {
      await s3DeleteHandler(key);
    }

    await Product.findByIdAndDelete(id);

    res.status(200).json({
      success: true,
      message: "Product and its images deleted successfully",
    });

  } catch (err) {
    next(err);
  }
};

const updateProductsStock = async (orderedItems, session) => {
  for (const item of orderedItems) {
    const product = await Product.findById(item.product_id).session(session);
    if (!product) {
      throw new CustomError(`Product not found: ${item.product_id}`, 404);
    }

    const updatedStock = product.stock - item.quantity;
    if (updatedStock < 0) {
      throw new CustomError(`Insufficient product stock: ${item.product_id}`, 400);
    }

    product.stock = updatedStock;
    await product.save({ session });
  }
};





module.exports = {
  createProduct,
  getAllProducts,
  getProductById,
  updateProduct,
  deleteProduct,
  updateProductsStock
};
