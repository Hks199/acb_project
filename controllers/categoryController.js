const Category = require("../models/Category");

// Create category
createCategory = async (req, res) => {
  try {
    const { category } = req.body;

    if (!category) {
      return res.status(400).json({ message: "Category is required." });
    }

    const existing = await Category.findOne({ category });
    if (existing) {
      return res.status(409).json({ message: "Category already exists." });
    }

    const newCategory = await Category.create({ category });
    res.status(201).json(newCategory);
  } catch (error) {
    res.status(500).json({ message: "Error creating category", error });
  }
};

// Get all categories
getAllCategories = async (req, res) => {
  try {
    const categories = await Category.find().sort({ createdAt: -1 });
    res.status(200).json(categories);
  } catch (error) {
    res.status(500).json({ message: "Error fetching categories", error });
  }
};

// Get single category by ID
getCategoryById = async (req, res) => {
  try {
    const category = await Category.findById(req.params.id);
    if (!category) return res.status(404).json({ message: "Category not found" });

    res.status(200).json(category);
  } catch (error) {
    res.status(500).json({ message: "Error retrieving category", error });
  }
};

// Update category
updateCategory = async (req, res) => {
  try {
    const { category } = req.body;
    const updated = await Category.findByIdAndUpdate(
      req.params.id,
      { category },
      { new: true, runValidators: true }
    );
    if (!updated) return res.status(404).json({ message: "Category not found" });

    res.status(200).json(updated);
  } catch (error) {
    res.status(500).json({ message: "Error updating category", error });
  }
};

// Delete category
deleteCategory = async (req, res) => {
  try {
    const deleted = await Category.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ message: "Category not found" });

    res.status(200).json({ message: "Category deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: "Error deleting category", error });
  }
};

module.exports = {
    createCategory,
    getAllCategories,
    getCategoryById,
    updateCategory,
    deleteCategory
}