const driverService = require('../services/driverService');
const { roomFor } = require('../utils/grid');

let io = null;
// driverId -> grid room the driver was last announced in
const driverRooms = new Map();

exports.init = (ioServer) => {
  io = ioServer;
};

// Tell passengers around the driver about the new position.
// If the driver crossed into another cell, passengers who can only
// see the old cell are told to drop the marker.
exports.broadcastDriverUpdate = (driver, user) => {
  if (!io || !driver.location) return;

  const [lng, lat] = driver.location.coordinates;
  const id = String(driver._id);
  const newRoom = roomFor(lat, lng);
  const oldRoom = driverRooms.get(id);

  if (oldRoom && oldRoom !== newRoom) {
    io.to(oldRoom).except(newRoom).emit('driver:removed', { id });
  }
  driverRooms.set(id, newRoom);

  io.to(newRoom).emit('driver:update', driverService.toLivePayload(driver, user));
};

// Driver went offline / timed out
exports.broadcastDriverRemoved = (driver) => {
  if (!io) return;

  const id = String(driver._id);
  let room = driverRooms.get(id);
  if (!room && driver.location && driver.location.coordinates) {
    const [lng, lat] = driver.location.coordinates;
    room = roomFor(lat, lng);
  }
  driverRooms.delete(id);

  if (room) io.to(room).emit('driver:removed', { id });
};
