const Vendor = require("../models/vendorRegistrationModel.js");
const { CustomError } = require("../errors/CustomErrorHandler.js");
const {s3UploadHandler} = require("../helpers/s3BucketUploadHandler");
// ✅ Create Vendor

const createVendor = async (req, res, next) => {
  try {
    const {
      vendor_name,
      art_type,
      description,
      email,
      mobile_number,
      gender,
      landmark,
      state,
      city,
      country,
    } = req.body;

    // Check for existing vendor
    const existing = await Vendor.findOne({
      $or: [{ email }, { mobile_number }],
    });
    if (existing) {
      return next(
        new CustomError("DuplicateVendor", "Vendor with this email or mobile already exists", 409)
      );
    }

        const imageArray = Array.isArray(req.files.images)
          ? req.files.images
          : [req.files.images]

        const uploadedImageUrls = [];
        const uploadedImageKeys = [];
    
        for (const image of imageArray) {
          try {
            const { fileKey, publicUrl } = await s3UploadHandler(image, "returnImage");
            uploadedImageUrls.push(publicUrl);
            uploadedImageKeys.push(fileKey);
          } catch (err) {
            console.error("S3 upload failed:", err);
          }
      }

    // Create Vendor
    const newVendor = await Vendor.create({
      vendor_name,
      art_type,
      description,
      email,
      mobile_number,
      gender,
      landmark,
      state,
      city,
      country,
      imageUrls : uploadedImageUrls,
    });

    res.status(201).json({
      success: true,
      message: "Vendor created successfully",
      data: newVendor,
    });
  } catch (error) {
    next(
      error instanceof CustomError
        ? error
        : new CustomError("CreateVendorError", error.message, 400)
    );
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


const getVendorWiseProducts = async (req, res, next) => {
  try {
    let { page = 1, limit = 10 } = req.body;
    page = parseInt(page);
    limit = parseInt(limit);

    const skip = (page - 1) * limit;

    const pipeline = [
      {
        $lookup: {
          from: "products",
          localField: "_id",
          foreignField: "vendor_id",
          as: "products"
        }
      },
      {
        $project: {
          vendor_name: 1,
          email: 1,
          art_type: 1,
          description: 1,
          imageUrls: 1,
          products: {
            $map: {
              input: "$products",
              as: "prod",
              in: {
                productId: "$$prod.productId",
                product_name: "$$prod.product_name",
                price: "$$prod.price",
                stock: "$$prod.stock",
                imageUrls: "$$prod.imageUrls",
                isActive: "$$prod.isActive"
              }
            }
          }
        }
      },
      {
        $skip: skip
      },
      {
        $limit: limit
      }
    ];

    const data = await Vendor.aggregate(pipeline);

    const total = await Vendor.countDocuments();
    const totalPages = Math.ceil(total / limit);

    res.status(200).json({
      success: true,
      page,
      total,
      totalPages,
      pageSize: data.length,
      data
    });
  } catch (error) {
    next(new CustomError("GetVendorWiseInventoryError", error.message, 500));
  }
};


module.exports = {
    createVendor,
    getAllVendors,
    getVendorById,
    updateVendor,
    deleteVendor,
    getVendorWiseProducts
}