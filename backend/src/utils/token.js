const jwt = require('jsonwebtoken');
const { JWT_EXPIRES_IN } = require('../config/constants');

exports.signToken = (userId) =>
  jwt.sign({ id: userId }, process.env.JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
