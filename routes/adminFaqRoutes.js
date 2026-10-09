const router = require('express').Router();
const { authMiddleware, roleMiddleware } = require('../middlewares/auth');
const controller = require('../controllers/faqController');
router.use(authMiddleware, roleMiddleware(['Admin']));
router.get('/', controller.getAll);
router.post('/', controller.create);
router.put('/:id', controller.update);
router.delete('/:id', controller.remove);
module.exports = router;
