const express = require("express");
const router = express.Router();
const {authMiddleware,roleMiddleware} = require("../middlewares/auth");
const {
  addToCart,
  getCart,
  updateCartItem,
  removeCartItem,
  clearCart,
  calculateCartTotalAmount
} = require("../controllers/cartController");

// No auth middleware used
router.post("/addToCart",authMiddleware, addToCart);
router.get("/getCartbyId/:user_id",authMiddleware, getCart);
router.patch("/updateCartItem",authMiddleware, updateCartItem);
router.post("/removeCartItem",authMiddleware, removeCartItem);
router.delete("/clearCart",authMiddleware, clearCart);
router.post("/calculateCartTotalAmount/:userId",authMiddleware, calculateCartTotalAmount);
module.exports = router;

// POST /cart/add
// {
//   "user_id": "665a3f5fcf4b0c5f3dbb2a9b",
//   "product_id": "665a3f5fcf4b0c5f3dbb2a9c",
//   "variant_id": "665a4005cf4b0c5f3dbb2a9e",
//   "quantity": 2
// }

// GET /cart?user_id=665a3f5fcf4b0c5f3dbb2a9b
