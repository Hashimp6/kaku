const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const driverService = require('../services/driverService');
const realtime = require('./realtime');
const { roomsForRadius } = require('../utils/grid');
const { parseCoordinates } = require('../utils/validators');
const C = require('../config/constants');

// Runs a handler, always answers through the ack callback, never crashes the server
const handle = (fn) => async (payload, ack) => {
  const reply = typeof ack === 'function' ? ack : () => {};
  try {
    const data = await fn(payload && typeof payload === 'object' ? payload : {});
    reply({ success: true, ...data });
  } catch (err) {
    const safe = err.isOperational || err.name === 'ValidationError' || err.name === 'CastError';
    if (!safe) console.error('Socket handler error:', err);
    reply({ success: false, message: safe ? err.message : 'Server error' });
  }
};

const registerDriverHandlers = (socket) => {
  const { user } = socket;

  // { lat, lng, speed?, heading? }
  socket.on(
    'driver:online',
    handle(async (payload) => {
      const driver = await driverService.setStatus(user, {
        ...payload,
        availabilityStatus: 'available',
      });
      realtime.broadcastDriverUpdate(driver, user);
      return {
        availabilityStatus: driver.availabilityStatus,
        lastLocationUpdate: driver.lastLocationUpdate,
      };
    })
  );

  socket.on(
    'driver:offline',
    handle(async (payload) => {
      const driver = await driverService.setStatus(user, {
        ...payload,
        availabilityStatus: 'offline',
      });
      realtime.broadcastDriverRemoved(driver);
      return { availabilityStatus: driver.availabilityStatus };
    })
  );

  // { lat, lng, speed?, heading? }
  socket.on(
    'driver:location',
    handle(async (payload) => {
      const now = Date.now();
      if (socket.data.lastLocationAt && now - socket.data.lastLocationAt < C.SOCKET_MIN_LOCATION_INTERVAL_MS) {
        return { throttled: true };
      }
      socket.data.lastLocationAt = now;

      const driver = await driverService.updateLocation(user, payload);
      realtime.broadcastDriverUpdate(driver, user);
      return {
        movementStatus: driverService.getMovementStatus(driver),
        lastLocationUpdate: driver.lastLocationUpdate,
      };
    })
  );
};

const registerPassengerHandlers = (socket) => {
  // { lat, lng, radius? }  -> joins the grid cells around the passenger
  // and returns the current nearby drivers. Call again when the passenger moves.
  socket.on(
    'passenger:watch',
    handle(async (payload) => {
      const { lat, lng } = parseCoordinates(payload.lat, payload.lng);

      let radius = Number(payload.radius) || C.NEARBY_DEFAULT_RADIUS_METERS;
      radius = Math.min(Math.max(radius, 100), C.NEARBY_MAX_RADIUS_METERS);

      for (const room of socket.data.rooms || []) socket.leave(room);
      const rooms = roomsForRadius(lat, lng, radius);
      socket.join(rooms); // join first so no update is missed during the query
      socket.data.rooms = rooms;

      const drivers = await driverService.findNearby({ lat, lng, radius });
      return { count: drivers.length, radius, drivers };
    })
  );

  socket.on(
    'passenger:unwatch',
    handle(async () => {
      for (const room of socket.data.rooms || []) socket.leave(room);
      socket.data.rooms = [];
      return {};
    })
  );
};

module.exports = (httpServer) => {
  // Tighten `origin` before production. Native apps ignore CORS anyway.
  const io = new Server(httpServer, { cors: { origin: '*' } });
  realtime.init(io);

  // Same JWT as the REST API: io(URL, { auth: { token } })
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth && socket.handshake.auth.token;
      if (!token) return next(new Error('Authentication required'));

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(decoded.id);
      if (!user || !user.isActive) return next(new Error('Account not found or disabled'));

      socket.user = user;
      next();
    } catch (err) {
      next(new Error('Invalid or expired token'));
    }
  });

  io.on('connection', (socket) => {
    const { role } = socket.user;
    if (role === 'driver') registerDriverHandlers(socket);
    if (role === 'passenger' || role === 'admin') registerPassengerHandlers(socket);
  });

  return io;
};
