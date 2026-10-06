const router = require('express').Router();
const controller = require('../controllers/popupCampaignController');
router.get('/active', controller.active);
router.post('/:id/subscribe', controller.subscribe);
module.exports = router;
