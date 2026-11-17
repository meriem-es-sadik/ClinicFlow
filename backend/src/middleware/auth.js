'use strict';

const AppError = require('../utils/AppError');
const { verifyToken } = require('../utils/jwt');
const userService = require('../services/user.service');

/**
 * Authentication middleware.
 * Expects an `Authorization: Bearer <token>` header. On success attaches the
 * sanitised user (id, fullName, email, role) to `req.user`.
 */
async function authenticate(req, res, next) {
  try {
    const header = req.headers.authorization || '';
    const [scheme, token] = header.split(' ');

    if (!token || scheme !== 'Bearer') {
      throw AppError.unauthorized('Missing or malformed Authorization header');
    }

    let payload;
    try {
      payload = verifyToken(token);
    } catch (err) {
      if (err.name === 'TokenExpiredError') {
        throw AppError.unauthorized('Session expired, please log in again');
      }
      throw AppError.unauthorized('Invalid authentication token');
    }

    // Load the user to make sure it still exists and to get the current role.
    const user = await userService.findById(payload.sub);
    if (!user) {
      throw AppError.unauthorized('The account linked to this token no longer exists');
    }

    req.user = user;
    return next();
  } catch (err) {
    return next(err);
  }
}

module.exports = authenticate;
