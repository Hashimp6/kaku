const Driver = require('../models/Driver');
const AppError = require('../utils/AppError');
const { haversineMeters } = require('../utils/geo');
const {
  requireString,
  optionalNumber,
  parseCoordinates,
  normalizeRegistration,
} = require('../utils/validators');
const C = require('../config/constants');

const VEHICLE_FIELDS = [
  'vehicleType',
  'registrationNumber',
  'model',
  'color',
  'seatingCapacity',
  'photo',
];

const plain = (doc) => (doc && typeof doc.toObject === 'function' ? doc.toObject() : doc);

// Movement is derived, not stored: "moving" if we saw real movement recently
const getMovementStatus = (driver, now = Date.now()) => {
  if (!driver.lastMovedAt) return 'stationary';
  const ageMs = now - new Date(driver.lastMovedAt).getTime();
  return ageMs <= C.DRIVER_MOVING_WINDOW_SECONDS * 1000 ? 'moving' : 'stationary';
};

// Shape sent to passengers (user must be populated on driver.userId)
const toPublicDriver = (driver, distance) => {
  const d = plain(driver);
  const user = d.userId || {};
  const coords = d.location && d.location.coordinates;
  return {
    id: d._id,
    name: user.name,
    profileImage: user.profileImage,
    phone: user.phone,
    whatsappNumber: user.whatsappNumber,
    vehicle: d.vehicle,
    movementStatus: getMovementStatus(d),
    distance: distance === undefined ? undefined : Math.round(distance),
    location: coords ? { lat: coords[1], lng: coords[0] } : undefined,
    lastLocationUpdate: d.lastLocationUpdate,
  };
};

const getDriverOrThrow = async (userId) => {
  const driver = await Driver.findOne({ userId });
  if (!driver) throw new AppError('Create your driver profile first', 404);
  return driver;
};

// Writes location + works out whether the driver is really moving
const applyLocation = (driver, { lat, lng, speed, heading }) => {
  const now = new Date();
  let moved = typeof speed === 'number' && speed >= C.MOVING_SPEED_MPS;

  const prev = driver.location && driver.location.coordinates;
  if (prev && haversineMeters(prev[1], prev[0], lat, lng) >= C.MOVING_DISTANCE_METERS) {
    moved = true;
  }
  if (moved) driver.lastMovedAt = now;

  driver.location = { type: 'Point', coordinates: [lng, lat] };
  driver.speed = speed;
  driver.heading = heading;
  driver.lastLocationUpdate = now;
};

// ---------------- profile ----------------
exports.saveProfile = async (user, body) => {
  const vehicleInput = body.vehicle && typeof body.vehicle === 'object' ? body.vehicle : {};

  let driver = await Driver.findOne({ userId: user._id });
  const isNew = !driver;
  if (isNew) driver = new Driver({ userId: user._id });

  let sensitiveChanged = false;

  if (body.licenseNumber !== undefined) {
    const lic = requireString(body.licenseNumber, 'Licence number').toUpperCase();
    if (driver.licenseNumber !== lic) sensitiveChanged = true;
    driver.licenseNumber = lic;
  }

  for (const key of VEHICLE_FIELDS) {
    const value = vehicleInput[key];
    if (value === undefined) continue;
    if (key === 'registrationNumber') {
      const reg = normalizeRegistration(requireString(value, 'Registration number'));
      if (!isNew && driver.vehicle && driver.vehicle.registrationNumber !== reg) {
        sensitiveChanged = true;
      }
    }
    driver.set(`vehicle.${key}`, value);
  }

  // Re-submission after rejection, or changed licence/registration => review again
  if (!isNew && (sensitiveChanged || driver.verificationStatus === 'rejected')) {
    driver.verificationStatus = 'pending';
    driver.rejectionReason = undefined;
    driver.availabilityStatus = 'offline';
  }

  await driver.save();
  return driver;
};

exports.getOwnProfile = async (user) => {
  const driver = await getDriverOrThrow(user._id);
  return { ...driver.toJSON(), movementStatus: getMovementStatus(driver) };
};

// ---------------- online / offline / location ----------------
exports.setStatus = async (user, body) => {
  const status = body.availabilityStatus;
  if (!['available', 'offline'].includes(status)) {
    throw new AppError('availabilityStatus must be "available" or "offline"', 400);
  }

  const driver = await getDriverOrThrow(user._id);

  if (status === 'available') {
    if (driver.verificationStatus !== 'approved') {
      throw new AppError('Your profile has not been approved yet', 403);
    }
    // Need a fresh position to appear on the map
    const { lat, lng } = parseCoordinates(body.lat, body.lng);
    applyLocation(driver, {
      lat,
      lng,
      speed: optionalNumber(body.speed, 'speed'),
      heading: optionalNumber(body.heading, 'heading'),
    });
    driver.availabilityStatus = 'available';
  } else {
    driver.availabilityStatus = 'offline';
    driver.speed = undefined;
    driver.heading = undefined;
  }

  await driver.save();
  return driver;
};

exports.updateLocation = async (user, body) => {
  const driver = await getDriverOrThrow(user._id);
  if (driver.availabilityStatus !== 'available') {
    throw new AppError('Go online before sharing your location', 409);
  }

  const { lat, lng } = parseCoordinates(body.lat, body.lng);
  applyLocation(driver, {
    lat,
    lng,
    speed: optionalNumber(body.speed, 'speed'),
    heading: optionalNumber(body.heading, 'heading'),
  });

  await driver.save();
  return driver;
};

// ---------------- passenger side ----------------
exports.findNearby = async ({ lat, lng, radius }) => {
  const cutoff = new Date(Date.now() - C.DRIVER_ACTIVE_TIMEOUT_SECONDS * 1000);

  // $geoNear must be the first stage; it uses the 2dsphere index and
  // returns the distance in metres.
  const results = await Driver.aggregate([
    {
      $geoNear: {
        near: { type: 'Point', coordinates: [lng, lat] },
        distanceField: 'distance',
        maxDistance: radius,
        spherical: true,
        query: {
          verificationStatus: 'approved',
          availabilityStatus: 'available',
          lastLocationUpdate: { $gte: cutoff },
        },
      },
    },
    { $limit: C.NEARBY_MAX_RESULTS },
  ]);

  await Driver.populate(results, {
    path: 'userId',
    select: 'name phone whatsappNumber profileImage isActive',
  });

  return results
    .filter((d) => d.userId && d.userId.isActive)
    .map((d) => toPublicDriver(d, d.distance));
};

exports.getPublicById = async (id, viewer) => {
  const driver = await Driver.findById(id).populate(
    'userId',
    'name phone whatsappNumber profileImage'
  );
  if (!driver) throw new AppError('Driver not found', 404);
  if (viewer.role !== 'admin' && driver.verificationStatus !== 'approved') {
    throw new AppError('Driver not found', 404);
  }
  return toPublicDriver(driver);
};

// ---------------- admin ----------------
exports.listForAdmin = async (status) => {
  const filter = {};
  if (status) {
    if (!['pending', 'approved', 'rejected'].includes(status)) {
      throw new AppError('status must be pending, approved or rejected', 400);
    }
    filter.verificationStatus = status;
  }
  return Driver.find(filter)
    .populate('userId', 'name phone whatsappNumber profileImage isActive')
    .sort({ createdAt: -1 })
    .limit(100);
};

exports.setVerification = async (id, admin, decision, reason) => {
  const driver = await Driver.findById(id);
  if (!driver) throw new AppError('Driver not found', 404);

  driver.verificationStatus = decision;
  driver.verifiedAt = new Date();
  driver.verifiedBy = admin._id;

  if (decision === 'approved') {
    driver.rejectionReason = undefined;
  } else {
    driver.rejectionReason = requireString(reason, 'Rejection reason');
    driver.availabilityStatus = 'offline';
  }

  await driver.save();
  return driver;
};

// ---------------- housekeeping ----------------
// Visibility is already filtered by lastLocationUpdate at query time; this
// sweep also flips the stored status. Returns the affected drivers so the
// caller can tell connected passengers to remove them from their map.
exports.markStaleDriversOffline = async () => {
  const cutoff = new Date(Date.now() - C.DRIVER_ACTIVE_TIMEOUT_SECONDS * 1000);
  const stale = await Driver.find({
    availabilityStatus: 'available',
    lastLocationUpdate: { $lt: cutoff },
  })
    .select('_id location')
    .lean();

  if (stale.length === 0) return [];

  await Driver.updateMany(
    { _id: { $in: stale.map((d) => d._id) } },
    { $set: { availabilityStatus: 'offline' }, $unset: { speed: '', heading: '' } }
  );
  return stale;
};

// ---------------- real-time helpers ----------------
exports.getMovementStatus = getMovementStatus;

// Passenger-facing payload for a driver we already hold (user = the driver's User doc)
exports.toLivePayload = (driver, user) => toPublicDriver({ ...plain(driver), userId: user });
