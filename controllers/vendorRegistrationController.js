const Vendor = require("../models/vendorRegistrationModel.js");
const { CustomError } = require("../errors/CustomErrorHandler.js");

// ✅ Create Vendor
const createVendor = async (req, res, next) => {
  try {
    const vendor = await Vendor.create(req.body);
    res.status(201).json({ success: true, message: "Vendor created", data: vendor });
  } catch (error) {
    next(new CustomError("CreateVendorError", error.message, 400));
  }
};

// ✅ Get All Vendors (with pagination)
const getAllVendors = async (req, res, next) => {
  try {
    let {page = 1,limit = 10} = req.body;
    const skip = (page - 1) * limit;

    const vendors = await Vendor.find().skip(skip).limit(limit);
    const total = await Vendor.countDocuments();
    let totalPages = Math.ceil(total / limit)

    res.status(200).json({
      success: true,
      page,
      total,
      totalPages,
      pageSize: vendors.length,
      data: vendors,
    });
  } catch (error) {
    next(new CustomError("FetchVendorsError", error.message, 500));
  }
};

// ✅ Get Single Vendor by ID
const getVendorById = async (req, res, next) => {
  try {
    const vendor = await Vendor.findById(req.params.id);
    if (!vendor) {
      return next(new CustomError("VendorNotFound", "Vendor not found", 404));
    }
    res.status(200).json({ success: true, data: vendor });
  } catch (error) {
    next(new CustomError("FetchVendorError", error.message, 500));
  }
};

// ✅ Update Vendor
const updateVendor = async (req, res, next) => {
  try {
    const vendor = await Vendor.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });

    if (!vendor) {
      return next(new CustomError("VendorNotFound", "Vendor not found", 404));
    }

    res.status(200).json({ success: true, message: "Vendor updated"});
  } catch (error) {
    next(new CustomError("UpdateVendorError", error.message, 400));
  }
};

// ✅ Delete Vendor
const deleteVendor = async (req, res, next) => {
  try {
    const vendor = await Vendor.findByIdAndDelete(req.params.id);
    if (!vendor) {
      return next(new CustomError("VendorNotFound", "Vendor not found", 404));
    }

    res.status(200).json({ success: true, message: "Vendor deleted successfully" });
  } catch (error) {
    next(new CustomError("DeleteVendorError", error.message, 500));
  }
};

module.exports = {
    createVendor,
    getAllVendors,
    getVendorById,
    updateVendor,
    deleteVendor
}