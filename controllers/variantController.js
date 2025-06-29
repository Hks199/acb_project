const mongoose = require("mongoose");
const { CustomError } = require("../errors/CustomErrorHandler.js");
const ProductVariantSet = require("../models/variantModel.js");


const createVariantSet = async (req, res, next) => {
  try {
    const { productId, Size, Color, combinations } = req.body;

    if (!productId || !Array.isArray(combinations) || combinations.length === 0) {
      throw new CustomError("productId and combinations are required", 400);
    }

    const newSet = await ProductVariantSet.create({
      productId,
      Size,
      Color,
      combinations,
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
    const variantSets = await ProductVariantSet.find().populate("productId");
    res.status(200).json({
      success: true,
      data: variantSets,
    });
  } catch (error) {
    next(error);
  }
};


const getVariantSetByProductId = async (req, res, next) => {
  try {
    const { productId } = req.params;

    const variantSet = await ProductVariantSet.findOne({ productId }).populate("productId");

    if (!variantSet) {
      return res.status(404).json({ success: false, message: "Variant set not found" });
    }

    res.status(200).json({ success: true, data: variantSet });
  } catch (error) {
    next(error);
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
    const { product_id, variant_id, quantity } = item;

    const variantSet = await ProductVariantSet.findOne({ productId: product_id }).session(session);
    if (!variantSet) {
      throw new CustomError(`Variant set not found for product: ${product_id}`, 404);
    }

    const combination = variantSet.combinations.find(comb => comb._id.toString() === variant_id);
    if (!combination) {
      throw new CustomError(`Variant combination not found: ${variant_id}`, 404);
    }

    const updatedStock = combination.stock - quantity;
    if (updatedStock < 0) {
      throw new CustomError(`Insufficient stock for variant: ${variant_id}`, 400);
    }

    combination.stock = updatedStock;

    // Inform Mongoose that nested array is modified
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
  updateVariantsStock
};



// // CREATE
// const createVariant = async (req, res, next) => {
//   try {
//     let { product_id, size, color, price, stock } = req.body;

//     if (!product_id || !color || !size || !price) {
//       return res.status(400).json({
//         success: false,
//         message: "product_id, size, color and price are required",
//       });
//     }

//     size = size.toUpperCase();
//     color = color.toUpperCase();

//     // 🔍 Check if a variant with same product_id, size, and color already exists
//     const existingVariant = await Variant.findOne({
//       product_id,
//       size,
//       color,
//     });

//     if (existingVariant) {
//       return res.status(409).json({
//         success: false,
//         message: `Variant with size "${size}" and color "${color}" already exists for this product.`,
//       });
//     }

//     if (!req.files || !req.files.images) {
//       return res.status(400).json({
//         success: false,
//         message: "Images are required",
//       });
//     }

//     const images = Array.isArray(req.files.images)
//       ? req.files.images
//       : [req.files.images];

//     const uploadedImages = await Promise.all(
//       images.map(file => s3UploadHandler(file, "variants"))
//     );

//     const imageUrls = uploadedImages.map(img => img.publicUrl);
//     const imageKeys = uploadedImages.map(img => img.fileKey);

//     const newVariant = new Variant({
//       product_id,
//       size,
//       color,
//       price,
//       stock,
//       imageUrls,
//       imageKeys,
//     });

//     await newVariant.save();

//     res.status(201).json({
//       success: true,
//       message: "Variant created successfully",
//       data: newVariant,
//     });
//   } catch (err) {
//     next(err instanceof CustomError ? err : new CustomError(err.message, 500));
//   }
// };


// // READ ALL
// const getAllVariantsByProduct_id = async (req, res, next) => {
//   try {
//     const  product_id  = req.params.id;

//     // Validate if the product_id is a valid ObjectId
//     if (!mongoose.Types.ObjectId.isValid(product_id)) {
//       return next(new CustomError("Invalid product_id", 400));
//     }

//     const variants = await Variant.find({ product_id });

//     res.status(200).json({
//       success: true,
//       message: "Variants fetched successfully",
//       variants,
//     });
//   } catch (error) {
//     next(new CustomError("FetchVariantError", error.message, 500));
//   }
// };


// // READ ONE
// const getVariantById = async (req, res, next) => {
//   try {
//     const variant = await Variant.findById(req.params.id).populate("product_id");
//     if (!variant) return next(new CustomError("NotFound", "Variant not found", 404));
//     res.status(200).json({ success: true, variant });
//   } catch (error) {
//     next(new CustomError("FetchVariantError", error.message, 500));
//   }
// };

// // UPDATE
// const updateVariant = async (req, res, next) => {
//   try {
//     const { id } = req.params;

//     const existingVariant = await Variant.findById(id);
//     if (!existingVariant) {
//       return res.status(404).json({ success: false, message: "Variant not found" });
//     }

//     const { color, size, price, stock, isActive } = req.body;

//     // Handle image replacement if files provided
//     if (req.files && req.files.images) {
//       const images = Array.isArray(req.files.images)
//         ? req.files.images
//         : [req.files.images];

//       if (images.length !== existingVariant.imageKeys.length) {
//         return res.status(400).json({
//           success: false,
//           message: `You must upload exactly ${existingVariant.imageKeys.length} images to replace existing ones.`,
//         });
//       }

//       const updatedImageData = await Promise.all(
//         images.map((file, idx) =>
//           s3ReplaceHandler(file, existingVariant.imageKeys[idx])
//         )
//       );

//       existingVariant.imageUrls = updatedImageData.map(item => item.publicUrl);
//     }

//     // Update fields
//     if (color) existingVariant.color = color;
//     if (size) existingVariant.size = size;
//     if (price) existingVariant.price = price;
//     if (stock) existingVariant.stock = stock;
//     if (typeof isActive === "boolean") existingVariant.isActive = isActive;

//     await existingVariant.save();

//     res.status(200).json({
//       success: true,
//       message: "Variant updated successfully",
//       data: existingVariant,
//     });
//   } catch (err) {
//     next(err);
//   }
// };


// // DELETE
// const deleteVariant = async (req, res, next) => {
//   try {
//     const { id } = req.params;

//     const variant = await Variant.findById(id);
//     if (!variant) {
//       return res.status(404).json({ success: false, message: "Variant not found" });
//     }

//     // Delete all images from S3
//     await Promise.all(
//       variant.imageKeys.map(key => s3DeleteHandler(key))
//     );

//     await variant.deleteOne();

//     res.status(200).json({
//       success: true,
//       message: "Variant deleted successfully",
//     });
//   } catch (err) {
//     next(err);
//   }
// };

// const updateVariantsStock = async (orderedItems, session) => {
//   for (const item of orderedItems) {
//     const variant = await Variant.findById(item.variant_id).session(session);
//     if (!variant) {
//       throw new CustomError(`Variant not found: ${item.variant_id}`, 404);
//     }

//     const updatedStock = variant.stock - item.quantity;
//     if (updatedStock < 0) {
//       throw new CustomError(`Insufficient variant stock: ${item.variant_id}`, 400);
//     }

//     variant.stock = updatedStock;
//     await variant.save({ session });
//   }
// };



// module.exports = {
//   createVariant,
//   getAllVariantsByProduct_id,
//   getVariantById,
//   updateVariant,
//   deleteVariant,
//   updateVariantsStock
// };

