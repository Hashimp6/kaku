const AppError = require('./AppError');

const requireString = (value, field) => {
  if (typeof value !== 'string' || !value.trim()) {
    throw new AppError(`${field} is required`, 400);
  }
  return value.trim();
};

// Returns undefined for missing/empty, throws if not text
const optionalString = (value, field) => {
  if (value === undefined || value === null || value === '') return undefined;
  if (typeof value !== 'string') throw new AppError(`${field} must be text`, 400);
  return value.trim();
};

const optionalNumber = (value, field) => {
  if (value === undefined || value === null || value === '') return undefined;
  const n = Number(value);
  if (!Number.isFinite(n)) throw new AppError(`${field} must be a number`, 400);
  return n;
};

// Accepts 9876543210, +91 98765 43210, 09876543210 -> "9876543210"
const normalizePhone = (value, field = 'Phone number') => {
  const raw = requireString(value, field);
  let digits = raw.replace(/\D/g, '');
  if (digits.length === 12 && digits.startsWith('91')) digits = digits.slice(2);
  else if (digits.length === 11 && digits.startsWith('0')) digits = digits.slice(1);
  if (!/^[6-9]\d{9}$/.test(digits)) {
    throw new AppError(`${field} must be a valid 10-digit Indian mobile number`, 400);
  }
  return digits;
};

// "kl-11 ab 1234" -> "KL11AB1234"
const normalizeRegistration = (value) =>
  String(value).toUpperCase().replace(/[\s-]/g, '');

const parseCoordinates = (lat, lng) => {
  const missing = (v) => v === undefined || v === null || v === '';
  if (missing(lat) || missing(lng)) {
    throw new AppError('lat and lng are required', 400);
  }
  const la = Number(lat);
  const lo = Number(lng);
  if (!Number.isFinite(la) || !Number.isFinite(lo) || Math.abs(la) > 90 || Math.abs(lo) > 180) {
    throw new AppError('lat/lng are not valid coordinates', 400);
  }
  return { lat: la, lng: lo };
};

module.exports = {
  requireString,
  optionalString,
  optionalNumber,
  normalizePhone,
  normalizeRegistration,
  parseCoordinates,
};
