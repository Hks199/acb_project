const ImageList = require("../models/listofImagesModel");
const { s3UploadHandler, s3DeleteHandler, s3ReplaceHandler } = require("../helpers/s3BucketUploadHandler.js");
const { CustomError } = require("../errors/CustomErrorHandler.js");
// 📌 CREATE
const createImage = async (req, res, next) => {
  try {
    const { title } = req.body;

    if (!req.files || !req.files.image) {
      throw new CustomError("Image file is required", 400);
    }

    const { publicUrl, fileKey } = await s3UploadHandler(req.files.image, "gallery");

    const imageDoc = new ImageList({
      title,
      imageUrls: publicUrl,
      imageKeys: fileKey,
    });

    await imageDoc.save();

    res.status(201).json({
      success: true,
      message: "Image uploaded successfully",
      data: imageDoc,
    });
  } catch (err) {
    next(err instanceof CustomError ? err : new CustomError(err.message, 500));
  }
};

// 📌 READ ALL
const getAllImages = async (req, res, next) => {
    try {
      const page = parseInt(req.body.page) || 1;           // Current page number (default: 1)
      const limit = parseInt(req.body.limit) || 10;        // Number of items per page (default: 10)
      const skip = (page - 1) * limit;                      // Documents to skip
  
      const total = await ImageList.countDocuments();       // Total image documents
  
      const images = await ImageList.find()
        .sort({ createdAt: -1 }) // Optional: latest first
        .skip(skip)
        .limit(limit);
  
      res.status(200).json({
        success: true,
        currentPage: page,
        totalPages: Math.ceil(total / limit),
        totalItems: total,
        count: images.length,
        data: images,
      });
    } catch (err) {
      next(new CustomError(err.message, 500));
    }
  };
  

// 📌 UPDATE
const updateImage = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { title } = req.body;

    const imageDoc = await ImageList.findById(id);
    if (!imageDoc) {
      throw new CustomError("Image not found", 404);
    }

    if (req.files && req.files.image) {
      const { publicUrl, fileKey } = await s3ReplaceHandler(req.files.image, imageDoc.imageKeys);
      imageDoc.imageUrls = publicUrl;
      imageDoc.imageKeys = fileKey;
    }

    if (title) imageDoc.title = title;

    await imageDoc.save();

    res.status(200).json({
      success: true,
      message: "Image updated successfully",
      data: imageDoc,
    });
  } catch (err) {
    next(new CustomError(err.message, 500));
  }
};

// 📌 DELETE
const deleteImage = async (req, res, next) => {
  try {
    const { id } = req.params;

    const imageDoc = await ImageList.findById(id);
    if (!imageDoc) {
      throw new CustomError("Image not found", 404);
    }

    await s3DeleteHandler(imageDoc.imageKeys);
    await imageDoc.deleteOne();

    res.status(200).json({
      success: true,
      message: "Image deleted successfully",
    });
  } catch (err) {
    next(new CustomError(err.message, 500));
  }
};

module.exports = {
  createImage,
  getAllImages,
  updateImage,
  deleteImage,
};
