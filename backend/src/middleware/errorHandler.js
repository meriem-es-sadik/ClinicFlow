'use strict';

const { ZodError } = require('zod');
const env = require('../config/env');
const AppError = require('../utils/AppError');
const { formatZodError } = require('./validate');

/* eslint-disable no-unused-vars */
function errorHandler(err, req, res, next) {
  let error = err;

  // Normalise known error shapes into an AppError-like structure.
  if (err instanceof ZodError) {
    error = formatZodError(err);
  } else if (err.type === 'entity.parse.failed' || err instanceof SyntaxError) {
    error = AppError.badRequest('Malformed JSON in request body');
  } else if (err.code && PG_ERROR_MAP[err.code]) {
    error = PG_ERROR_MAP[err.code](err);
  }

  const statusCode = error.statusCode || 500;
  const isServerError = statusCode >= 500;

  if (isServerError) {
    console.error('[error]', err);
  }

  const body = {
    success: false,
    error: {
      message: isServerError && env.isProduction ? 'Internal server error' : error.message,
      code: error.code || (isServerError ? 'INTERNAL_ERROR' : 'ERROR'),
    },
  };

  if (error.details) {
    body.error.details = error.details;
  }

  if (!env.isProduction && isServerError) {
    body.error.stack = err.stack;
  }

  res.status(statusCode).json(body);
}

const PG_ERROR_MAP = {
  // unique_violation
  '23505': (err) => {
    if (err.constraint === 'patients_cin_unique') {
      return AppError.conflict('A patient with this CIN already exists');
    }
    if (err.constraint === 'users_email_unique') {
      return AppError.conflict('An account with this email already exists');
    }
    return AppError.conflict('A record with these values already exists');
  },
  // exclusion_violation - the 30 minute business rule safety net
  '23P01': () =>
    AppError.conflict(
      'This patient already has a confirmed appointment within a 30 minute window',
    ),
  // foreign_key_violation
  '23503': () => AppError.badRequest('Referenced record does not exist'),
  // invalid_text_representation (e.g. malformed UUID / date)
  '22P02': () => AppError.badRequest('One of the provided values has an invalid format'),
  // invalid_datetime_format
  '22007': () => AppError.badRequest('One of the provided dates has an invalid format'),
};

module.exports = errorHandler;
