'use strict';

const { z } = require('zod');

/**
 * A UUID path parameter (used to validate `:id`).
 */
const uuidParam = z
  .string({ required_error: 'An id is required' })
  .uuid('The provided id is not a valid UUID');

const idParamsSchema = z.object({ id: uuidParam });

/**
 * Shared pagination query schema.
 * `page` and `limit` are coerced from strings (query params are always strings).
 */
const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
});

module.exports = { z, uuidParam, idParamsSchema, paginationSchema };
