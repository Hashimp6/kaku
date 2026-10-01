const User = require('../models/User');
const AppError = require('../utils/AppError');
const { signToken } = require('../utils/token');
const { requireString, optionalString, normalizePhone } = require('../utils/validators');

const SELF_SERVICE_ROLES = ['passenger', 'driver']; // admin can never be self-registered

exports.register = async (body) => {
  const name = requireString(body.name, 'Name');
  const phone = normalizePhone(body.phone);
  const password = requireString(body.password, 'Password');
  const role = body.role === undefined ? 'passenger' : body.role;

  if (!SELF_SERVICE_ROLES.includes(role)) {
    throw new AppError('Role must be passenger or driver', 400);
  }

  const whatsapp = optionalString(body.whatsappNumber, 'WhatsApp number');

  const user = await User.create({
    name,
    phone,
    password,
    role,
    email: optionalString(body.email, 'Email'),
    whatsappNumber: whatsapp ? normalizePhone(whatsapp, 'WhatsApp number') : undefined,
    profileImage: optionalString(body.profileImage, 'Profile image'),
  });

  return { user, token: signToken(user._id) };
};

exports.login = async (body) => {
  const phone = normalizePhone(body.phone);
  const password = requireString(body.password, 'Password');

  const user = await User.findOne({ phone }).select('+password');
  // Same message for both cases so attackers can't tell which part was wrong
  if (!user || !(await user.comparePassword(password))) {
    throw new AppError('Invalid phone number or password', 401);
  }
  if (!user.isActive) throw new AppError('This account has been disabled', 403);

  return { user, token: signToken(user._id) };
};

exports.updateProfile = async (user, body) => {
  const name = optionalString(body.name, 'Name');
  const email = optionalString(body.email, 'Email');
  const whatsapp = optionalString(body.whatsappNumber, 'WhatsApp number');
  const image = optionalString(body.profileImage, 'Profile image');

  if (name) user.name = name;
  if (email) user.email = email;
  if (whatsapp) user.whatsappNumber = normalizePhone(whatsapp, 'WhatsApp number');
  if (image) user.profileImage = image;

  await user.save();
  return user;
};
