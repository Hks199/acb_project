const express = require("express");
const router = express.Router();
const {
    createCategory,
    getAllCategories,
    getCategoryById,
    updateCategory,
    deleteCategory
} = require("../controllers/categoryController");

// CREATE
router.post("/", createCategory);

// READ ALL
router.get("/", getAllCategories);

// READ ONE
router.get("/:id", getCategoryById);

// UPDATE
router.put("/:id", updateCategory);

// DELETE
router.delete("/:id", deleteCategory);

module.exports = router;
