// Usage: npm run create-admin
// Reads ADMIN_NAME, ADMIN_PHONE, ADMIN_PASSWORD from .env
require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../src/models/User');
const { normalizePhone } = require('../src/utils/validators');

(async () => {
  try {
    const { ADMIN_NAME, ADMIN_PHONE, ADMIN_PASSWORD, MONGO_URI } = process.env;
    if (!ADMIN_PHONE || !ADMIN_PASSWORD) {
      throw new Error('Set ADMIN_PHONE and ADMIN_PASSWORD in .env first');
    }
    await mongoose.connect(MONGO_URI);

    const phone = normalizePhone(ADMIN_PHONE);
    let user = await User.findOne({ phone }).select('+password');

    if (user) {
      user.role = 'admin';
      await user.save();
      console.log(`Existing user ${phone} promoted to admin`);
    } else {
      await User.create({
        name: ADMIN_NAME || 'Admin',
        phone,
        password: ADMIN_PASSWORD,
        role: 'admin',
      });
      console.log(`Admin created: ${phone}`);
    }
  } catch (err) {
    console.error('Failed:', err.message);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
})();
