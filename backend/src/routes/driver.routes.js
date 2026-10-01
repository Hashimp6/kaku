const express = require('express');
const ctrl = require('../controllers/driver.controller');
const { protect, restrictTo } = require('../middleware/auth');

const router = express.Router();

router.use(protect);

// Driver only (order matters: fixed paths before "/:id")
router.post('/profile', restrictTo('driver'), ctrl.saveProfile);
router.patch('/profile', restrictTo('driver'), ctrl.saveProfile);
router.get('/me', restrictTo('driver'), ctrl.getMyProfile);
router.patch('/status', restrictTo('driver'), ctrl.setStatus);
router.patch('/location', restrictTo('driver'), ctrl.updateLocation);

// Passenger (and admin)
router.get('/nearby', restrictTo('passenger', 'admin'), ctrl.getNearby);
router.get('/:id', restrictTo('passenger', 'admin'), ctrl.getDriverById);

module.exports = router;
