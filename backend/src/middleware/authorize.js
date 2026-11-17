'use strict';

const AppError = require('../utils/AppError');

/**
 * Role-based authorization middleware factory.
 *
 *   router.delete('/:id', authenticate, authorize('admin'), handler)
 *
 * Must be used after `authenticate`.
 */
function authorize(...allowedRoles) {
  return function authorizeMiddleware(req, res, next) {
    if (!req.user) {
      return next(AppError.unauthorized());
    }
    if (!allowedRoles.includes(req.user.role)) {
      return next(
        AppError.forbidden(
          `This action requires one of the following roles: ${allowedRoles.join(', ')}`,
        ),
      );
    }
    return next();
  };
}

module.exports = authorize;
