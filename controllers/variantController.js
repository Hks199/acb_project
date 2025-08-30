const mongoose = require("mongoose");
const { CustomError } = require("../errors/CustomErrorHandler.js");
const ProductVariantSet = require("../models/variantModel.js");


const createVariantSet = async (req, res, next) => {
  try {
    const { productId,varient_name, Size, Color, combinations,color_images} = req.body;

    if (!productId || !Array.isArray(combinations) || combinations.length === 0) {
      throw new CustomError("productId and combinations are required", 400);
    }

    const newSet = await ProductVariantSet.create({
      productId,
      varient_name,
      Size,
      Color,
      combinations,
      color_images
    });

    res.status(201).json({
      success: true,
      message: "Variant set created successfully",
      // data: newSet,
    });
  } catch (error) {
    next(error instanceof CustomError ? error : new CustomError(error.message, 500));
  }
};



const getAllVariantSets = async (req, res, next) => {
  try {
    const page = parseInt(req.body.page) || 1;        // default page = 1
    const limit = parseInt(req.body.limit) || 10;     // default limit = 10
    const skip = (page - 1) * limit;

    const [variantSets, total] = await Promise.all([
      ProductVariantSet.find()
        .skip(skip)
        .limit(limit),
      ProductVariantSet.countDocuments()
    ]);

    res.status(200).json({
      success: true,
      total,
      page,
      totalPages: Math.ceil(total / limit),
      count: variantSets.length,
      data: variantSets,
    });
  } catch (error) {
    next(error);
  }
};



async function getVariantSetByProductId(productId) {
  try {
    const variantSet = await ProductVariantSet.findOne({ productId }).populate("productId");

    if (!variantSet) {
      return null; // Optional: return null instead of undefined
    }

    return variantSet;
  } catch (error) {
    throw new Error(error.message || "Failed to fetch variant set");
  }
}

const editVariantSetByProductId = async (req, res, next) => {
  try {
    const { id } = req.params;

    const variantSet = await ProductVariantSet.findOne({ _id: id });

    if (!variantSet) {
      return res.status(404).json({
        success: false,
        message: "Variant set not found for this product",
      });
    }

    return res.status(200).json({
      success: true,
      data: variantSet,
    });

  } catch (error) {
    next(new CustomError("EditVariantSetError", error.message || "Failed to fetch variant set", 500));
  }
};



const updateVariantSet = async (req, res, next) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const updated = await ProductVariantSet.findByIdAndUpdate(id, updates, { new: true });

    if (!updated) {
      return res.status(404).json({ success: false, message: "Variant set not found" });
    }

    res.status(200).json({
      success: true,
      message: "Variant set updated successfully",
      data: updated,
    });
  } catch (error) {
    next(error);
  }
};


const deleteVariantSet = async (req, res, next) => {
  try {
    const { id } = req.params;

    const deleted = await ProductVariantSet.findByIdAndDelete(id);

    if (!deleted) {
      return res.status(404).json({ success: false, message: "Variant set not found" });
    }

    res.status(200).json({
      success: true,
      message: "Variant set deleted successfully",
    });
  } catch (error) {
    next(error);
  }
};



const updateVariantsStock = async (orderedItems, session) => {
  for (const item of orderedItems) {
    const { product_id, variant_combination_id, quantity } = item;

    if (!product_id || !variant_combination_id || typeof quantity !== "number") {
      // console.warn("Invalid ordered item detected:", item);
      continue;
    }

    const variantSet = await ProductVariantSet.findOne({ productId: product_id }).session(session);
    if (!variantSet) continue;

    const combination = variantSet.combinations.find(
      (comb) => comb._id.toString() === variant_combination_id.toString()
    );
    if (!combination) continue;

    const newStock = combination.stock - quantity;

    // Validation: only check out-of-stock if we are reducing stock
    if (quantity > 0 && newStock < 0) {
      throw new CustomError("OutOfStock", `Insufficient stock for combination ID ${variant_combination_id}`, 400);
    }

    // Update
    combination.stock = newStock;

    variantSet.markModified("combinations");
    await variantSet.save({ session });
  }
};


module.exports = {
  createVariantSet,
  getAllVariantSets,
  getVariantSetByProductId,
  updateVariantSet,
  deleteVariantSet,
  updateVariantsStock,
  editVariantSetByProductId
};



