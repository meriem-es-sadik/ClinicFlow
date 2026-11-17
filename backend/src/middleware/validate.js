'use strict';

const { ZodError } = require('zod');
const AppError = require('../utils/AppError');

/**
 * Validation middleware factory backed by Zod.
 *
 *   router.post('/', validate(schema), handler)          // validates body
 *   router.get('/', validate(schema, 'query'), handler)  // validates query
 *
 * The parsed (and coerced) value replaces `req[source]` so controllers receive
 * clean, typed data.
 */
function validate(schema, source = 'body') {
  return function validateMiddleware(req, res, next) {
    const result = schema.safeParse(req[source]);

    if (!result.success) {
      return next(formatZodError(result.error));
    }

    if (source === 'query') {
      // req.query is a getter in Express 5; assign onto a plain property.
      Object.defineProperty(req, 'query', {
        value: result.data,
        writable: true,
        configurable: true,
        enumerable: true,
      });
    } else {
      req[source] = result.data;
    }

    return next();
  };
}

function formatZodError(error) {
  const details = error.issues.map((issue) => ({
    field: issue.path.join('.') || '_root',
    message: issue.message,
    code: issue.code,
  }));
  return AppError.validation('Validation failed', details);
}

module.exports = { validate, formatZodError, ZodError };
