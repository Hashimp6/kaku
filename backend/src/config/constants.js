// Tunable values. Everything can be overridden from .env.
const int = (value, fallback) => {
  const n = parseInt(value, 10);
  return Number.isFinite(n) ? n : fallback;
};
const num = (value, fallback) => {
  const n = parseFloat(value);
  return Number.isFinite(n) ? n : fallback;
};

module.exports = {
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '7d',

  // Driver with no location update for this long is treated as offline
  DRIVER_ACTIVE_TIMEOUT_SECONDS: int(process.env.DRIVER_ACTIVE_TIMEOUT_SECONDS, 120),
  STALE_SWEEP_INTERVAL_SECONDS: int(process.env.STALE_SWEEP_INTERVAL_SECONDS, 60),

  // "Moving" detection (tune on real devices)
  DRIVER_MOVING_WINDOW_SECONDS: int(process.env.DRIVER_MOVING_WINDOW_SECONDS, 60),
  MOVING_SPEED_MPS: num(process.env.MOVING_SPEED_MPS, 1), // ~3.6 km/h
  MOVING_DISTANCE_METERS: num(process.env.MOVING_DISTANCE_METERS, 25),

  // Nearby search
  NEARBY_DEFAULT_RADIUS_METERS: int(process.env.NEARBY_DEFAULT_RADIUS_METERS, 2000),
  NEARBY_MAX_RADIUS_METERS: int(process.env.NEARBY_MAX_RADIUS_METERS, 10000),
  NEARBY_MAX_RESULTS: 50,

  // Real-time (Socket.IO)
  // Passengers only receive drivers from grid cells around them.
  // 0.02 degrees is roughly 2.2 km.
  GRID_CELL_DEGREES: num(process.env.GRID_CELL_DEGREES, 0.02),
  // Ignore driver location events arriving faster than this
  SOCKET_MIN_LOCATION_INTERVAL_MS: int(process.env.SOCKET_MIN_LOCATION_INTERVAL_MS, 1000),
};
