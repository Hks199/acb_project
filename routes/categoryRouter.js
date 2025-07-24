const express = require("express");
const router = express.Router();
const {authMiddleware,roleMiddleware} = require("../middlewares/auth");
const {
    createCategory,
    getAllCategories,
    getCategoryById,
    updateCategory,
    deleteCategory
} = require("../controllers/categoryController");

// CREATE
router.post("/createCategory",authMiddleware, createCategory);

// READ ALL
router.get("/getAllCategories",authMiddleware, getAllCategories);

// READ ONE
router.get("/getCategoryById/:id",authMiddleware, getCategoryById);

// UPDATE
router.patch("/updateCategory/:id",authMiddleware, updateCategory);

// DELETE
router.delete("/deleteCategory/:id",authMiddleware, deleteCategory);

module.exports = router;
