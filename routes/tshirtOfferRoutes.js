const router = require('express').Router();
const { getTshirtOffer, saveTshirtOffer } = require('../controllers/tshirtOfferController');

// Uses the same admin access convention as the existing promotion management routes.
router.get('/', getTshirtOffer);
router.put('/', saveTshirtOffer);
module.exports = router;
