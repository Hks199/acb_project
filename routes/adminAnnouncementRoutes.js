const router = require('express').Router();
const { authMiddleware, roleMiddleware } = require('../middlewares/auth');
const controller = require('../controllers/announcementController');
router.use(authMiddleware, roleMiddleware(['Admin']));
router.get('/', controller.getAll);
router.post('/', controller.create);
router.put('/:id', controller.update);
router.patch('/:id/toggle', controller.toggle);
module.exports = router;
