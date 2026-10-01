const express = require('express');
const ctrl = require('../controllers/admin.controller');
const { protect, restrictTo } = require('../middleware/auth');

const router = express.Router();

router.use(protect, restrictTo('admin'));

router.get('/drivers', ctrl.listDrivers);
router.patch('/drivers/:id/approve', ctrl.approveDriver);
router.patch('/drivers/:id/reject', ctrl.rejectDriver);

module.exports = router;
