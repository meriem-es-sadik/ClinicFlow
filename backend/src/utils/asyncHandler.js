'use strict';

/**
 * Wrap an async route handler so rejected promises are forwarded to Express's
 * error handling pipeline instead of crashing the process.
 *
 *   router.get('/', asyncHandler(async (req, res) => { ... }))
 */
function asyncHandler(fn) {
  return function wrapped(req, res, next) {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

module.exports = asyncHandler;
