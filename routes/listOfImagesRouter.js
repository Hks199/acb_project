const express = require("express");
const router = express.Router();
const {authMiddleware,roleMiddleware} = require("../middlewares/auth");
const {
  createImage,
  getAllImages,
  updateImage,
  deleteImage,
} = require("../controllers/listOfImagesController");

router.post("/create-image", createImage);
router.post("/getAll-image", getAllImages);
router.patch("/update-image/:id", updateImage);
router.delete("/delete-image/:id", deleteImage);

module.exports = router;
