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
router.post("/createCategory", createCategory);

// READ ALL
router.get("/getAllCategories", getAllCategories);

// READ ONE
router.get("/getCategoryById/:id", getCategoryById);

// UPDATE
router.patch("/updateCategory/:id", updateCategory);

// DELETE
router.delete("/deleteCategory/:id", deleteCategory);

module.exports = router;
