'use strict';

const db = require('../config/db');

const PUBLIC_COLUMNS = `id, full_name AS "fullName", email, role, created_at AS "createdAt"`;

/**
 * Find a user by id, returning only safe columns.
 */
async function findById(id) {
  const { rows } = await db.query(
    `SELECT ${PUBLIC_COLUMNS} FROM users WHERE id = $1`,
    [id],
  );
  return rows[0] || null;
}

/**
 * Find a user by email, including the password hash (used only by auth).
 */
async function findByEmailWithPassword(email) {
  const { rows } = await db.query(
    `SELECT id, full_name AS "fullName", email, role, password_hash AS "passwordHash"
       FROM users
      WHERE email = $1`,
    [email],
  );
  return rows[0] || null;
}

async function create({ fullName, email, passwordHash, role = 'staff' }) {
  const { rows } = await db.query(
    `INSERT INTO users (full_name, email, password_hash, role)
     VALUES ($1, $2, $3, $4)
     RETURNING ${PUBLIC_COLUMNS}`,
    [fullName, email, passwordHash, role],
  );
  return rows[0];
}

module.exports = { findById, findByEmailWithPassword, create };
