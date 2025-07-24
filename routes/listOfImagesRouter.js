const express = require("express");
const router = express.Router();
const {authMiddleware,roleMiddleware} = require("../middlewares/auth");
const {
  createImage,
  getAllImages,
  updateImage,
  deleteImage,
} = require("../controllers/listOfImagesController");

router.post("/create-image",authMiddleware, createImage);
router.post("/getAll-image",authMiddleware, getAllImages);
router.patch("/update-image/:id",authMiddleware, updateImage);
router.delete("/delete-image/:id",authMiddleware, deleteImage);

module.exports = router;
