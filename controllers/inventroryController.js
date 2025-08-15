const Product = require("../models/inventoryModel");
const { CustomError } = require("../errors/CustomErrorHandler.js");
const {getVariantSetByProductId} = require("./variantController.js");
const mongoose = require("mongoose");
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
      isActive,
      imageUrls
    } = req.body;
    
    // Basic validation
    if (!category_id || !vendor_id || !product_name || !description || !price || !imageUrls) {
      throw new CustomError("Missing required fields", 400);
    }

    // Parse description only if it's a string
    // const parsedDescription =
    //   typeof description === "string" ? JSON.parse(description) : description;

    // Ensure imageUrls and imageKeys are arrays
    const parsedImageUrls = Array.isArray(imageUrls) ? imageUrls : JSON.parse(imageUrls);

    const newProduct = new Product({
      category_id,
      vendor_id,
      product_name,
      description,
      price,
      stock,
      isActive,
      imageUrls: parsedImageUrls
    });

    await newProduct.save();

    return res.status(201).json({
      success: true,
      message: "Product created successfully",
      // data: newProduct,
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
    const productid = req.params.id;

    // Validate ObjectId if needed
    if (!mongoose.Types.ObjectId.isValid(productid)) {
      return next(new CustomError("InvalidId", "Invalid product ID", 400));
    }

    const product = await Product.findById(productid);
    if (!product) {
      return next(new CustomError("NotFound", "Product not found", 404));
    }

    const variantSet = await getVariantSetByProductId(product._id);

    res.status(200).json({
      success: true,
      product,
      variant: variantSet, // or rename to `variantSet` for clarity
    });

  } catch (error) {
    next(new CustomError("FetchProductError", error.message, 500));
  }
};


// DELETE
const deleteProduct = async (req, res, next) => {
  try {
    const { id } = req.params;

    const deletedProduct = await Product.findByIdAndDelete(id);

    if (!deletedProduct) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }
    res.status(200).json({
      success: true,
      message: "Product deleted successfully",
    });

  } catch (err) {
    next(err);
  }
};

const updateProduct = async (req, res, next) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    // Check if product exists
    const product = await Product.findById(id);
    if (!product) {
      return res.status(404).json({ 
        success: false, 
        message: "Product not found" 
      });
    }

    // Parse description if it's a stringified JSON
    if (updateData.description && typeof updateData.description === "string") {
      updateData.description = JSON.parse(updateData.description);
    }

    // Update product
    const updatedProduct = await Product.findByIdAndUpdate(id, updateData, {
      new: true,
      runValidators: true,
    });

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
    let { page = 1, limit = 10 } = req.body;
    page = parseInt(page);
    limit = parseInt(limit);
    const skip = (page - 1) * limit;

    const result = await Product.aggregate([
      {
        $sort: { createdAt: -1 }
      },
      {
        $facet: {
          data: [
            { $skip: skip },
            { $limit: limit },
            {
              $project: {
                _id: 1,
                productId: 1,
                product_name: 1,
                price: 1,
                stock: 1,
                imageUrls: 1,
                review_count: 1,
                avg_rating: 1,
                isActive: 1,
                category_id: 1,
                vendor_id: 1,
                description : 1
              }
            }
          ],
          totalCount: [
            { $count: "count" }
          ]
        }
      }
    ]);

    const products = result[0].data;
    const totalCount = result[0].totalCount[0]?.count || 0;
    const totalPages = Math.ceil(totalCount / limit);

    res.status(200).json({
      success: true,
      totalProducts: totalCount,
      totalPages,
      currentPage: page,
      products
    });

  } catch (error) {
    next(
      error instanceof CustomError
        ? error
        : new CustomError("GetProductsSortedByReviewsError", error.message, 500)
    );
  }
};




const getProductsByCategoryId = async (req, res, next) => {
  try {
    const { category_id } = req.body;

    const page = parseInt(req.body.page) || 1;       // Default page: 1
    const limit = parseInt(req.body.limit) || 10;    // Default limit: 10
    const skip = (page - 1) * limit;

    const [products, total] = await Promise.all([
      Product.find({ category_id })
        .skip(skip)
        .limit(limit),
      Product.countDocuments({ category_id })
    ]);

    if (!products || products.length === 0) {
      return next(new CustomError("NotFound", "No products found for this category", 404));
    }

    res.status(200).json({
      success: true,
      count: products.length,
      page,
      totalPages: Math.ceil(total / limit),
      totalItems: total,
      products,
    });
  } catch (error) {
    next(new CustomError("FetchProductError", error.message, 500));
  }
};


async function updateRatingAndReview(productId, averageRating, totalRatings) {
  try {
    const updatedProduct = await Product.findByIdAndUpdate(
      productId,
      {
        avg_rating: averageRating,
        review_count: totalRatings
      },
      { new: true }
    );

    if (!updatedProduct) {
      throw new Error("Product not found to update rating and review");
    }
  } catch (error) {
    console.error("Rating update failed:", error.message);
    throw new Error("Failed to update product rating and review count");
  }
}




module.exports = {
  createProduct,
  getAllProducts,
  getProductById,
  updateProduct,
  deleteProduct,
  updateProductsStock,
  searchProductsByName,
  getProductsSortedByReviews,
  getProductsByCategoryId,
  updateRatingAndReview
};
