const express = require("express");
const router = express.Router();
const contactForm = require("../controllers/contactFormController");

router.post('/contact-form',contactForm);
module.exports = router;