'use strict';

const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.resolve(__dirname, '..', '..', '.env') });

function toBool(value, fallback = false) {
  if (value === undefined || value === null || value === '') return fallback;
  return ['1', 'true', 'yes', 'on'].includes(String(value).toLowerCase());
}

function toInt(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? fallback : parsed;
}

const nodeEnv = process.env.NODE_ENV || 'development';
const isProduction = nodeEnv === 'production';

const jwtSecret = process.env.JWT_SECRET || 'change-me-to-a-long-random-secret-string';
if (isProduction && jwtSecret === 'change-me-to-a-long-random-secret-string') {
  // Fail fast rather than shipping a default secret to production.
  throw new Error('JWT_SECRET must be set to a strong value in production');
}

const env = {
  nodeEnv,
  isProduction,
  port: toInt(process.env.PORT, 4000),
  corsOrigin: (process.env.CORS_ORIGIN || 'http://localhost:5173')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
  jwt: {
    secret: jwtSecret,
    expiresIn: process.env.JWT_EXPIRES_IN || '8h',
  },
  bcryptRounds: toInt(process.env.BCRYPT_ROUNDS, 10),
  appointmentConflictWindowMinutes: toInt(
    process.env.APPOINTMENT_CONFLICT_WINDOW_MINUTES,
    30,
  ),
  db: {
    host: process.env.PGHOST || 'localhost',
    port: toInt(process.env.PGPORT, 5432),
    user: process.env.PGUSER || 'postgres',
    password: process.env.PGPASSWORD || 'postgres',
    database: process.env.PGDATABASE || 'clinicflow',
    ssl: toBool(process.env.PGSSL, false) ? { rejectUnauthorized: false } : false,
  },
};

module.exports = env;
