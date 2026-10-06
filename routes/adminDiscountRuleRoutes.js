const router = require('express').Router();
const { authMiddleware, roleMiddleware } = require('../middlewares/auth');
const controller = require('../controllers/discountRuleController');
router.use(authMiddleware, roleMiddleware(['Admin']));
router.get('/', controller.getAll);
router.put('/:ruleKey', controller.update);
module.exports = router;
