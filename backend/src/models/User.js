const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const PHONE_REGEX = /^[6-9]\d{9}$/;

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
      minlength: [2, 'Name is too short'],
      maxlength: [60, 'Name is too long'],
    },
    // Login identifier. Stored as 10 digits, e.g. "9876543210"
    phone: {
      type: String,
      required: [true, 'Phone number is required'],
      unique: true,
      match: [PHONE_REGEX, 'Enter a valid 10-digit Indian mobile number'],
    },
    whatsappNumber: {
      type: String,
      match: [PHONE_REGEX, 'Enter a valid 10-digit WhatsApp number'],
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
      unique: true,
      sparse: true, // many users may have no email
      match: [/^\S+@\S+\.\S+$/, 'Enter a valid email'],
    },
    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: [8, 'Password must be at least 8 characters'],
      select: false,
    },
    role: {
      type: String,
      enum: ['passenger', 'driver', 'admin'],
      default: 'passenger',
    },
    // URL only. Actual upload (Cloudinary/S3) comes later.
    profileImage: { type: String, trim: true },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

userSchema.pre('save', async function () {
  if (!this.isModified('password')) return;
  this.password = await bcrypt.hash(this.password, 12);
});

userSchema.methods.comparePassword = function (plain) {
  return bcrypt.compare(plain, this.password);
};

userSchema.set('toJSON', {
  transform: (doc, ret) => {
    delete ret.password;
    delete ret.__v;
    return ret;
  },
});

module.exports = mongoose.model('User', userSchema);
