'use strict';

const bcrypt = require('bcrypt');
const AppError = require('../utils/AppError');
const { signToken } = require('../utils/jwt');
const userService = require('./user.service');

/**
 * Authenticate a user with email + password.
 * Returns the sanitised user and a signed JWT.
 */
async function login({ email, password }) {
  const user = await userService.findByEmailWithPassword(email);

  // Use a constant message to avoid leaking which part was wrong.
  if (!user) {
    throw AppError.unauthorized('Invalid email or password');
  }

  const passwordMatches = await bcrypt.compare(password, user.passwordHash);
  if (!passwordMatches) {
    throw AppError.unauthorized('Invalid email or password');
  }

  const token = signToken(user);

  return {
    token,
    user: {
      id: user.id,
      fullName: user.fullName,
      email: user.email,
      role: user.role,
    },
  };
}

async function me(userId) {
  const user = await userService.findById(userId);
  if (!user) {
    throw AppError.notFound('User not found');
  }
  return user;
}

async function hashPassword(password) {
  return bcrypt.hash(password, require('../config/env').bcryptRounds);
}

module.exports = { login, me, hashPassword };
