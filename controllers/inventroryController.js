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
    // console.log(req.body)
    // console.log(req.files.images)  
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
      // data: newProduct
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

// DELETE
const deleteProduct = async (req, res, next) => {
  try {
    const { id } = req.params;

    const product = await Product.findById(id);
    if (!product) return res.status(404).json({ success: false, message: "Product not found" });

    // Delete all images from S3
    for (const key of product.imageKeys) {
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

const updateProduct = async (req, res, next) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    // Find product and validate existence
    const product = await Product.findById(id);
    if (!product) {
      return res.status(404).json({ 
        success: false, 
        message: "Product not found" 
      });
    }

    // Handle image updates if provided
    if (req.files && req.files.images) {
      const newImages = Array.isArray(req.files.images)
        ? req.files.images
        : [req.files.images];

      // More flexible validation (optional)
      if (newImages.length > product.imageKeys.length) {
        return res.status(400).json({
          success: false,
          message: `Too many images. Maximum ${product.imageKeys.length} allowed.`,
        });
      }

      const updatedUrls = [...product.imageUrls]; // Copy existing URLs

      try {
        for (let i = 0; i < newImages.length; i++) {
          const image = newImages[i];
          const fileKey = product.imageKeys[i];

          const { publicUrl } = await s3ReplaceHandler(image, fileKey);
          updatedUrls[i] = publicUrl; // Update specific index
        }
        updateData.imageUrls = updatedUrls;
      } catch (s3Error) {
        console.error("S3 Upload Error:", s3Error);
        return res.status(500).json({
          success: false,
          message: "Failed to update product images",
        });
      }
    }

    // Update product data
    const updatedProduct = await Product.findByIdAndUpdate(
      id, 
      updateData, 
      { new: true }
    );

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

const searchProductsByName = async (req, res, next) => {
  try {
    const { keyword = "", page = 1, limit = 10 } = req.body;

    const pageNumber = parseInt(page);
    const pageSize = parseInt(limit);
    const skip = (pageNumber - 1) * pageSize;

    if (!keyword.trim()) {
      throw new CustomError("Search keyword is required", 400);
    }

    const matchStage = {
      $match: {
        product_name: {
          $regex: keyword,
          $options: "i", // case-insensitive
        },
      },
    };

    const facetStage = {
      $facet: {
        metadata: [{ $count: "total" }],
        data: [
          { $skip: skip },
          { $limit: pageSize },
          {
            $project: {
              _id: 1,
              product_name: 1,
              price: 1,
              imageUrls: 1,
              avg_rating: 1,
              review_count: 1,
            },
          },
        ],
      },
    };

    const results = await Product.aggregate([matchStage, facetStage]);

    const total = results[0].metadata[0]?.total || 0;
    const products = results[0].data;

    res.status(200).json({
      success: true,
      page: pageNumber,
      totalPages: Math.ceil(total / pageSize),
      totalResults: total,
      resultsPerPage: pageSize,
      products,
    });
  } catch (error) {
    next(
      error instanceof CustomError
        ? error
        : new CustomError(error.message, 500)
    );
  }
};


const getProductsSortedByReviews = async (req, res, next) => {
  try {
    const { page = 1, limit = 10 } = req.body;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const products = await Product.aggregate([
      {
        $sort: { review_count: -1 } // Sort by review_count in descending order
      },
      {
        $skip: skip
      },
      {
        $limit: parseInt(limit)
      },
      {
        $project: {
          _id: 1,
          product_name: 1,
          price: 1,
          stock: 1,
          imageUrls: 1,
          review_count: 1,
          avg_rating: 1,
          isActive: 1,
          category_id: 1,
          vendor_id: 1
        }
      }
    ]);

    const totalCount = await Product.countDocuments();

    res.status(200).json({
      success: true,
      totalProducts: totalCount,
      totalPages: Math.ceil(totalCount / limit),
      currentPage: parseInt(page),
      products
    });
  } catch (error) {
    next(error instanceof CustomError ? error : new CustomError(error.message, 500));
  }
};



module.exports = {
  createProduct,
  getAllProducts,
  getProductById,
  updateProduct,
  deleteProduct,
  updateProductsStock,
  searchProductsByName,
  getProductsSortedByReviews
  
};
