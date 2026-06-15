const Promotion = require("../models/promotionModel");
const Product = require("../models/inventoryModel");
const { CustomError } = require("../errors/CustomErrorHandler");

// ─────────────────────────────────────────────────────────────────
//  ADMIN — Create a promotion for a product
//  POST /api/promotions
// ─────────────────────────────────────────────────────────────────
const createPromotion = async (req, res, next) => {
  try {
    const { product_id, min_quantity, promo_price, description, start_date, end_date } = req.body;

    if (!product_id || !min_quantity || !promo_price) {
      return next(
        new CustomError("BadRequest", "product_id, min_quantity, and promo_price are required", 400)
      );
    }

    if (min_quantity < 1) {
      return next(new CustomError("BadRequest", "min_quantity must be at least 1", 400));
    }

    // Verify product exists
    const product = await Product.findById(product_id).select("product_name");
    if (!product) {
      return next(new CustomError("NotFound", "Product not found", 404));
    }

    const promotion = await Promotion.create({
      product_id,
      min_quantity,
      promo_price,
      description: description || `Buy ${min_quantity} for ₹${promo_price}`,
      start_date: start_date || null,
      end_date: end_date || null,
      is_active: true,
    });

    return res.status(201).json({
      success: true,
      message: "Promotion created successfully",
      promotion,
    });
  } catch (error) {
    next(new CustomError("CreatePromotionError", error.message, 500));
  }
};

// ─────────────────────────────────────────────────────────────────
//  ADMIN — Update a promotion
//  PUT /api/promotions/:id
// ─────────────────────────────────────────────────────────────────
const updatePromotion = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { min_quantity, promo_price, description, is_active, start_date, end_date } = req.body;

    const promotion = await Promotion.findById(id);
    if (!promotion) {
      return next(new CustomError("NotFound", "Promotion not found", 404));
    }

    if (min_quantity !== undefined) promotion.min_quantity = min_quantity;
    if (promo_price !== undefined) promotion.promo_price = promo_price;
    if (description !== undefined) promotion.description = description;
    if (is_active !== undefined) promotion.is_active = is_active;
    if (start_date !== undefined) promotion.start_date = start_date;
    if (end_date !== undefined) promotion.end_date = end_date;

    await promotion.save();

    return res.status(200).json({
      success: true,
      message: "Promotion updated successfully",
      promotion,
    });
  } catch (error) {
    next(new CustomError("UpdatePromotionError", error.message, 500));
  }
};

// ─────────────────────────────────────────────────────────────────
//  ADMIN — Toggle a promotion on/off
//  PATCH /api/promotions/:id/toggle
// ─────────────────────────────────────────────────────────────────
const togglePromotion = async (req, res, next) => {
  try {
    const { id } = req.params;

    const promotion = await Promotion.findById(id);
    if (!promotion) {
      return next(new CustomError("NotFound", "Promotion not found", 404));
    }

    promotion.is_active = !promotion.is_active;
    await promotion.save();

    return res.status(200).json({
      success: true,
      message: `Promotion ${promotion.is_active ? "activated" : "deactivated"} successfully`,
      is_active: promotion.is_active,
    });
  } catch (error) {
    next(new CustomError("TogglePromotionError", error.message, 500));
  }
};

// ─────────────────────────────────────────────────────────────────
//  ADMIN — Delete a promotion
//  DELETE /api/promotions/:id
// ─────────────────────────────────────────────────────────────────
const deletePromotion = async (req, res, next) => {
  try {
    const { id } = req.params;

    const promotion = await Promotion.findByIdAndDelete(id);
    if (!promotion) {
      return next(new CustomError("NotFound", "Promotion not found", 404));
    }

    return res.status(200).json({
      success: true,
      message: "Promotion deleted successfully",
    });
  } catch (error) {
    next(new CustomError("DeletePromotionError", error.message, 500));
  }
};

// ─────────────────────────────────────────────────────────────────
//  ADMIN — Get ALL promotions (with product details)
//  GET /api/promotions
// ─────────────────────────────────────────────────────────────────
const getAllPromotions = async (req, res, next) => {
  try {
    const promotions = await Promotion.find()
      .populate("product_id", "product_name price imageUrls isActive")
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      count: promotions.length,
      promotions,
    });
  } catch (error) {
    next(new CustomError("GetAllPromotionsError", error.message, 500));
  }
};

// ─────────────────────────────────────────────────────────────────
//  USER — Get all ACTIVE promotions (in-date)
//  GET /api/promotions/active
// ─────────────────────────────────────────────────────────────────
const getActivePromotions = async (req, res, next) => {
  try {
    const now = new Date();

    const promotions = await Promotion.find({
      is_active: true,
      $or: [
        { start_date: null, end_date: null },
        { start_date: { $lte: now }, end_date: null },
        { start_date: null, end_date: { $gte: now } },
        { start_date: { $lte: now }, end_date: { $gte: now } },
      ],
    }).populate("product_id", "product_name price imageUrls avg_rating review_count isActive");

    // Filter out promotions where the product is inactive
    const filtered = promotions.filter(
      (p) => p.product_id && p.product_id.isActive !== false
    );

    return res.status(200).json({
      success: true,
      count: filtered.length,
      promotions: filtered,
    });
  } catch (error) {
    next(new CustomError("GetActivePromotionsError", error.message, 500));
  }
};

// ─────────────────────────────────────────────────────────────────
//  USER — Get active promotion for a specific product
//  GET /api/promotions/product/:productId
// ─────────────────────────────────────────────────────────────────
const getPromotionByProduct = async (req, res, next) => {
  try {
    const { productId } = req.params;
    const now = new Date();

    const promotion = await Promotion.findOne({
      product_id: productId,
      is_active: true,
      $or: [
        { start_date: null, end_date: null },
        { start_date: { $lte: now }, end_date: null },
        { start_date: null, end_date: { $gte: now } },
        { start_date: { $lte: now }, end_date: { $gte: now } },
      ],
    });

    if (!promotion) {
      return res.status(200).json({
        success: true,
        promotion: null,
        message: "No active promotion for this product",
      });
    }

    return res.status(200).json({
      success: true,
      promotion,
    });
  } catch (error) {
    next(new CustomError("GetPromotionByProductError", error.message, 500));
  }
};

module.exports = {
  createPromotion,
  updatePromotion,
  togglePromotion,
  deletePromotion,
  getAllPromotions,
  getActivePromotions,
  getPromotionByProduct,
};
