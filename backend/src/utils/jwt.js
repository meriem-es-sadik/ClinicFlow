'use strict';

const jwt = require('jsonwebtoken');
const env = require('../config/env');

/**
 * Sign a JWT for the given user. Only non-sensitive claims are embedded.
 */
function signToken(user) {
  return jwt.sign(
    {
      sub: user.id,
      email: user.email,
      role: user.role,
    },
    env.jwt.secret,
    { expiresIn: env.jwt.expiresIn },
  );
}

/**
 * Verify a JWT and return its payload. Throws if invalid/expired.
 */
function verifyToken(token) {
  return jwt.verify(token, env.jwt.secret);
}

module.exports = { signToken, verifyToken };
