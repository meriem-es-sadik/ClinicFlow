'use strict';

const AppError = require('../utils/AppError');

/**
 * Catch-all for unknown routes.
 */
function notFound(req, res, next) {
  next(AppError.notFound(`Route ${req.method} ${req.originalUrl} not found`));
}

module.exports = notFound;
