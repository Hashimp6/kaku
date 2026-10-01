const asyncHandler = require('../utils/asyncHandler');
const AppError = require('../utils/AppError');
const driverService = require('../services/driverService');
const realtime = require('../socket/realtime');
const { parseCoordinates } = require('../utils/validators');
const C = require('../config/constants');

// ----- driver -----
exports.saveProfile = asyncHandler(async (req, res) => {
  const driver = await driverService.saveProfile(req.user, req.body);
  // A changed licence/registration forces offline, so drop any live marker
  if (driver.availabilityStatus === 'offline') realtime.broadcastDriverRemoved(driver);
  res.status(200).json({ success: true, driver });
});

exports.getMyProfile = asyncHandler(async (req, res) => {
  const driver = await driverService.getOwnProfile(req.user);
  res.status(200).json({ success: true, driver });
});

exports.setStatus = asyncHandler(async (req, res) => {
  const driver = await driverService.setStatus(req.user, req.body);

  if (driver.availabilityStatus === 'available') {
    realtime.broadcastDriverUpdate(driver, req.user);
  } else {
    realtime.broadcastDriverRemoved(driver);
  }

  res.status(200).json({
    success: true,
    availabilityStatus: driver.availabilityStatus,
    lastLocationUpdate: driver.lastLocationUpdate,
  });
});

exports.updateLocation = asyncHandler(async (req, res) => {
  const driver = await driverService.updateLocation(req.user, req.body);
  realtime.broadcastDriverUpdate(driver, req.user);

  res.status(200).json({
    success: true,
    movementStatus: driverService.getMovementStatus(driver),
    lastLocationUpdate: driver.lastLocationUpdate,
  });
});

// ----- passenger -----
exports.getNearby = asyncHandler(async (req, res) => {
  const { lat, lng } = parseCoordinates(req.query.lat, req.query.lng);

  let radius = C.NEARBY_DEFAULT_RADIUS_METERS;
  if (req.query.radius !== undefined) {
    radius = Number(req.query.radius);
    if (!Number.isFinite(radius) || radius <= 0) {
      throw new AppError('radius must be a positive number (metres)', 400);
    }
    radius = Math.min(radius, C.NEARBY_MAX_RADIUS_METERS);
  }

  const drivers = await driverService.findNearby({ lat, lng, radius });
  res.status(200).json({ success: true, count: drivers.length, radius, drivers });
});

exports.getDriverById = asyncHandler(async (req, res) => {
  const driver = await driverService.getPublicById(req.params.id, req.user);
  res.status(200).json({ success: true, driver });
});
