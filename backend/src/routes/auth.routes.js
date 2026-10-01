const express = require('express');
const ctrl = require('../controllers/auth.controller');
const { protect } = require('../middleware/auth');
const { authLimiter } = require('../middleware/rateLimiters');

const router = express.Router();

router.post('/register', authLimiter, ctrl.register);
router.post('/login', authLimiter, ctrl.login);
router.get('/me', protect, ctrl.getMe);
router.patch('/me', protect, ctrl.updateMe);

module.exports = router;
