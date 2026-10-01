const mongoose = require('mongoose');
const { normalizeRegistration } = require('../utils/validators');

// GeoJSON point: coordinates are [longitude, latitude]
const pointSchema = new mongoose.Schema(
  {
    type: { type: String, enum: ['Point'], required: true },
    coordinates: { type: [Number], required: true },
  },
  { _id: false }
);

const driverSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
    },

    // ----- Verification documents / details -----
    licenseNumber: {
      type: String,
      required: [true, 'Driving licence number is required'],
      trim: true,
      uppercase: true,
    },

    // ----- Vehicle -----
    vehicle: {
      vehicleType: { type: String, enum: ['auto', 'car', 'bike'], default: 'auto' },
      registrationNumber: {
        type: String,
        required: [true, 'Vehicle registration number is required'],
        set: (v) => (v == null ? v : normalizeRegistration(v)),
        match: [/^[A-Z0-9]{6,12}$/, 'Enter a valid registration number, e.g. KL11AB1234'],
      },
      model: { type: String, trim: true, maxlength: 60 },
      color: { type: String, trim: true, maxlength: 30 },
      seatingCapacity: { type: Number, min: 1, max: 8, default: 3 },
      photo: { type: String, trim: true }, // URL
    },

    // ----- Admin verification -----
    verificationStatus: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'pending',
    },
    rejectionReason: { type: String, trim: true },
    verifiedAt: Date,
    verifiedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },

    // ----- Live availability -----
    availabilityStatus: {
      type: String,
      enum: ['offline', 'available'],
      default: 'offline',
    },
    // default undefined: a driver with no fix yet must NOT have an empty
    // location object, or the 2dsphere index rejects the document.
    location: { type: pointSchema, default: undefined },
    speed: Number, // m/s, from device GPS
    heading: Number, // degrees
    lastLocationUpdate: Date,
    lastMovedAt: Date, // when we last saw real movement (used for moving vs parked)
  },
  { timestamps: true }
);

driverSchema.index({ location: '2dsphere' });
driverSchema.index({ verificationStatus: 1, availabilityStatus: 1, lastLocationUpdate: -1 });
driverSchema.index({ 'vehicle.registrationNumber': 1 }, { unique: true });

driverSchema.set('toJSON', {
  transform: (doc, ret) => {
    delete ret.__v;
    return ret;
  },
});

module.exports = mongoose.model('Driver', driverSchema);
