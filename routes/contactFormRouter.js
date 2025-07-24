const express = require("express");
const {authMiddleware,roleMiddleware} = require("../middlewares/auth");
const router = express.Router();
const contactForm = require("../controllers/contactFormController");

router.post('/contact-form',contactForm);
module.exports = router;
