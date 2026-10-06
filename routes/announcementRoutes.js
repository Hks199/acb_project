const router = require('express').Router();
router.get('/active', require('../controllers/announcementController').getActive);
module.exports = router;
