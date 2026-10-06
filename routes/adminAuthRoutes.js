const router = require('express').Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const User = require('../models/userModel');
const { CustomError } = require('../errors/CustomErrorHandler');
const { authMiddleware, roleMiddleware } = require('../middlewares/auth');
router.post('/login', async (req, res, next) => {
  try {
    const { identifier, password } = req.body || {};
    if (typeof identifier !== 'string' || typeof password !== 'string' || !identifier.trim() || !password) {
      throw new CustomError('InvalidInput', 'Enter your admin email or mobile number and password.', 400);
    }
    const user = await User.findOne({ $or: [{ email: identifier.trim() }, { mobile_number: identifier.trim() }] });
    if (!user || !(await bcrypt.compare(password, user.password)) || user.role !== 'Admin') {
      throw new CustomError('InvalidCredentials', 'Invalid admin credentials.', 401);
    }
    if (!user.isOtpVerify) throw new CustomError('UnverifiedUser', 'Verify your account through the storefront before signing in.', 403);
    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRY || '7d' });
    res.json({ token });
  } catch (error) { next(error); }
});
router.get('/session', authMiddleware, roleMiddleware(['Admin']), (req, res) => res.json({ role: req.user.role }));
module.exports = router;
