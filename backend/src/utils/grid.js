const { GRID_CELL_DEGREES: CELL } = require('../config/constants');

const METERS_PER_DEGREE = 111320;

// The room (grid cell) a coordinate belongs to
const roomFor = (lat, lng) => `cell:${Math.floor(lng / CELL)}:${Math.floor(lat / CELL)}`;

// All rooms that cover a circle of `radius` metres around a point
const roomsForRadius = (lat, lng, radius) => {
  const dLat = radius / METERS_PER_DEGREE;
  const dLng = radius / (METERS_PER_DEGREE * Math.max(Math.cos((lat * Math.PI) / 180), 0.01));

  const minX = Math.floor((lng - dLng) / CELL);
  const maxX = Math.floor((lng + dLng) / CELL);
  const minY = Math.floor((lat - dLat) / CELL);
  const maxY = Math.floor((lat + dLat) / CELL);

  const rooms = [];
  for (let x = minX; x <= maxX; x++) {
    for (let y = minY; y <= maxY; y++) rooms.push(`cell:${x}:${y}`);
  }
  return rooms;
};

module.exports = { roomFor, roomsForRadius };
