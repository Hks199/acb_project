const express = require("express");
const router = express.Router();
const {
  addToCart,
  getCart,
  updateCartItem,
  removeCartItem,
  clearCart,
} = require("../controllers/cartController");

// No auth middleware used
router.post("/addToCart", addToCart);
router.get("/getCart", getCart);
router.patch("/updateCartItem", updateCartItem);
router.delete("/removeCartItem", removeCartItem);
router.delete("/clearCart", clearCart);

module.exports = router;

// POST /cart/add
// {
//   "user_id": "665a3f5fcf4b0c5f3dbb2a9b",
//   "product_id": "665a3f5fcf4b0c5f3dbb2a9c",
//   "variant_id": "665a4005cf4b0c5f3dbb2a9e",
//   "quantity": 2
// }

// GET /cart?user_id=665a3f5fcf4b0c5f3dbb2a9b
