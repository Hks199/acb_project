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
    getAllUsers,
    getUserByAuthToken
 } = require("../controllers/userController");

router.post("/register", registerUser); 
router.post("/verify-otp", verifyOtp);
router.post("/login", loginUser);
router.post("/forgot-password", forgotPassword);
router.post("/logout-user",authMiddleware,logoutUser)
router.post("/update-password",authMiddleware, updatePassword);
router.post("/getuser-byid/:id",authMiddleware,getUserById);
router.patch("/update-user/:id",authMiddleware,updateUser);
router.post("/getuser-statistics",authMiddleware,getUserStatistics)
router.get("/getAllUsers",authMiddleware, getAllUsers); // ?role=User or Admin
router.get("/getUserByAuthToken",authMiddleware,getUserByAuthToken);


module.exports = router