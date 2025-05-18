const express = require("express");
const router = express.Router();
const {authMiddleware,roleMiddleware} = require("../middlewares/auth");
const {
    registerUser,
    verifyOtp,
    loginUser,
    forgotPassword,
    updatePassword,
    updateUser,
    logoutUser,
    getUserById,
    getUserStatistics,
    getAllUsers
 } = require("../controllers/userController");

router.post("/register", registerUser); 
router.post("/verify-otp", verifyOtp);
router.post("/login", loginUser);
router.post("/forgot-password", forgotPassword);
router.post("/logout-user",logoutUser)
router.post("/update-password", updatePassword);
router.post("/getuser-byid/:id",getUserById);
router.patch("/update-user/:id",updateUser);
router.post("/getuser-statistics",getUserStatistics)
router.get("/getAllUsers", getAllUsers); // ?role=User or Admin



module.exports = router