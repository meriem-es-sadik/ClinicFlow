'use strict';

const db = require('../config/db');

const PATIENT_COLUMNS = `
  id,
  full_name AS "fullName",
  cin,
  phone,
  to_char(birth_date, 'YYYY-MM-DD') AS "birthDate",
  address,
  created_at AS "createdAt",
  updated_at AS "updatedAt"
`;

async function create(data) {
  const { fullName, cin, phone, birthDate, address } = data;
  const { rows } = await db.query(
    `INSERT INTO patients (full_name, cin, phone, birth_date, address)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING ${PATIENT_COLUMNS}`,
    [fullName, cin, phone, birthDate, address ?? null],
  );
  return rows[0];
}

async function findById(id) {
  const { rows } = await db.query(
    `SELECT ${PATIENT_COLUMNS} FROM patients WHERE id = $1`,
    [id],
  );
  return rows[0] || null;
}

/**
 * Paginated list with optional search on full name or CIN.
 * Returns { data, meta }.
 */
async function list({ search, page = 1, limit = 10 }) {
  const values = [];
  let where = '';

  if (search) {
    values.push(`%${search}%`);
    where = `WHERE full_name ILIKE $1 OR cin ILIKE $1`;
  }

  const countSql = `SELECT COUNT(*)::int AS total FROM patients ${where}`;
  const { rows: countRows } = await db.query(countSql, values);
  const total = countRows[0].total;

  const offset = (page - 1) * limit;
  const dataValues = [...values, limit, offset];
  const limitIdx = values.length + 1;
  const offsetIdx = values.length + 2;

  const { rows } = await db.query(
    `SELECT ${PATIENT_COLUMNS}
       FROM patients
       ${where}
      ORDER BY created_at DESC, full_name ASC
      LIMIT $${limitIdx} OFFSET $${offsetIdx}`,
    dataValues,
  );

  return {
    data: rows,
    meta: {
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    },
  };
}

async function update(id, data) {
  const allowed = {
    fullName: 'full_name',
    cin: 'cin',
    phone: 'phone',
    birthDate: 'birth_date',
    address: 'address',
  };

  const setClauses = [];
  const values = [];

  for (const [key, column] of Object.entries(allowed)) {
    if (data[key] !== undefined) {
      values.push(data[key]);
      setClauses.push(`${column} = $${values.length}`);
    }
  }

  values.push(id);
  const { rows } = await db.query(
    `UPDATE patients
        SET ${setClauses.join(', ')}
      WHERE id = $${values.length}
      RETURNING ${PATIENT_COLUMNS}`,
    values,
  );
  return rows[0] || null;
}

async function remove(id) {
  const { rowCount } = await db.query('DELETE FROM patients WHERE id = $1', [id]);
  return rowCount > 0;
}

async function exists(id) {
  const { rows } = await db.query('SELECT 1 FROM patients WHERE id = $1', [id]);
  return rows.length > 0;
}

module.exports = { create, findById, list, update, remove, exists };
