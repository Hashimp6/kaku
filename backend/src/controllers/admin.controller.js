const asyncHandler = require('../utils/asyncHandler');
const driverService = require('../services/driverService');

exports.listDrivers = asyncHandler(async (req, res) => {
  const drivers = await driverService.listForAdmin(req.query.status);
  res.status(200).json({ success: true, count: drivers.length, drivers });
});

exports.approveDriver = asyncHandler(async (req, res) => {
  const driver = await driverService.setVerification(req.params.id, req.user, 'approved');
  res.status(200).json({ success: true, driver });
});

exports.rejectDriver = asyncHandler(async (req, res) => {
  const driver = await driverService.setVerification(
    req.params.id,
    req.user,
    'rejected',
    req.body.reason
  );
  res.status(200).json({ success: true, driver });
});
