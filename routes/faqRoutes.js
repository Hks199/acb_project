const router = require('express').Router();
router.get('/', require('../controllers/faqController').getActive);
module.exports = router;
