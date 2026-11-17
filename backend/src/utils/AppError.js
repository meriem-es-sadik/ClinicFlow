'use strict';

/**
 * Operational error with an HTTP status code and optional machine-readable code.
 * Thrown anywhere in the app and translated to a JSON response by the error
 * handler middleware.
 */
class AppError extends Error {
  constructor(message, statusCode = 500, code = undefined, details = undefined) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }

  static badRequest(message = 'Bad request', details) {
    return new AppError(message, 400, 'BAD_REQUEST', details);
  }

  static unauthorized(message = 'Authentication required') {
    return new AppError(message, 401, 'UNAUTHORIZED');
  }

  static forbidden(message = 'You are not allowed to perform this action') {
    return new AppError(message, 403, 'FORBIDDEN');
  }

  static notFound(message = 'Resource not found') {
    return new AppError(message, 404, 'NOT_FOUND');
  }

  static conflict(message = 'Conflict', details) {
    return new AppError(message, 409, 'CONFLICT', details);
  }

  static validation(message = 'Validation failed', details) {
    return new AppError(message, 422, 'VALIDATION_ERROR', details);
  }
}

module.exports = AppError;
