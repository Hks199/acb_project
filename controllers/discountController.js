const Discount = require("../models/discountModel");

// CREATE (POST)
exports.createDiscount = async (req, res) => {
  try {
    const discount = new Discount(req.body);
    const savedDiscount = await discount.save();

    res.status(201).json({
      success: true,
      data: savedDiscount,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// GET ALL
exports.getAllDiscounts = async (req, res) => {
  try {
    const discounts = await Discount.find();

    res.status(200).json({
      success: true,
      data: discounts,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// GET SINGLE
exports.getDiscountById = async (req, res) => {
  try {
    const discount = await Discount.findById(req.params.id);

    if (!discount) {
      return res.status(404).json({ message: "Discount not found" });
    }

    res.status(200).json({
      success: true,
      data: discount,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// UPDATE (PATCH)
exports.updateDiscount = async (req, res) => {
  try {
    const updatedDiscount = await Discount.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true }
    );

    if (!updatedDiscount) {
      return res.status(404).json({ message: "Discount not found" });
    }

    res.status(200).json({
      success: true,
      data: updatedDiscount,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// DELETE
exports.deleteDiscount = async (req, res) => {
  try {
    const deleted = await Discount.findByIdAndDelete(req.params.id);

    if (!deleted) {
      return res.status(404).json({ message: "Discount not found" });
    }

    res.status(200).json({
      success: true,
      message: "Discount deleted successfully",
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};