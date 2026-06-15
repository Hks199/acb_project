const express = require("express");
const router = express.Router();

const {
  createPromotion,
  updatePromotion,
  togglePromotion,
  deletePromotion,
  getAllPromotions,
  getActivePromotions,
  getPromotionByProduct,
} = require("../controllers/promotionController");

// ─── USER ROUTES ────────────────────────────────────────────────
// Must be defined BEFORE /:id routes to avoid conflicts

// GET /api/promotions/active  → All active promotions with product details
router.get("/active", getActivePromotions);

// GET /api/promotions/product/:productId  → Active promo for a specific product
router.get("/product/:productId", getPromotionByProduct);

// ─── ADMIN ROUTES ───────────────────────────────────────────────

// GET /api/promotions  → List all promotions (admin)
router.get("/", getAllPromotions);

// POST /api/promotions  → Create a new promotion
router.post("/", createPromotion);

// PUT /api/promotions/:id  → Update a promotion
router.put("/:id", updatePromotion);

// PATCH /api/promotions/:id/toggle  → Toggle active/inactive
router.patch("/:id/toggle", togglePromotion);

// DELETE /api/promotions/:id  → Delete a promotion
router.delete("/:id", deletePromotion);

module.exports = router;
