'use strict';

const { Pool } = require('pg');
const env = require('./env');

const pool = new Pool({
  host: env.db.host,
  port: env.db.port,
  user: env.db.user,
  password: env.db.password,
  database: env.db.database,
  ssl: env.db.ssl,
  max: 10,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 10_000,
});

pool.on('error', (err) => {
  // Errors on idle clients should never crash the process.
  console.error('[db] unexpected idle client error:', err.message);
});

/**
 * Run a parameterised query with the shared pool.
 */
function query(text, params) {
  return pool.query(text, params);
}

/**
 * Acquire a dedicated client (must be released by the caller).
 */
function getClient() {
  return pool.connect();
}

/**
 * Run `callback` inside a transaction. The callback receives a client and its
 * return value is returned once the transaction is committed. Any thrown error
 * triggers a ROLLBACK.
 */
async function withTransaction(callback) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch (rollbackErr) {
      console.error('[db] rollback failed:', rollbackErr.message);
    }
    throw err;
  } finally {
    client.release();
  }
}

async function checkConnection() {
  const { rows } = await pool.query('SELECT 1 AS ok');
  return rows[0].ok === 1;
}

async function closePool() {
  await pool.end();
}

module.exports = { pool, query, getClient, withTransaction, checkConnection, closePool };
