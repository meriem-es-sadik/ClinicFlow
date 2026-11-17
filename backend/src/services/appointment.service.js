'use strict';

const db = require('../config/db');
const env = require('../config/env');
const AppError = require('../utils/AppError');

const APPOINTMENT_COLUMNS = `
  a.id,
  a.patient_id       AS "patientId",
  a.appointment_date AS "appointmentDate",
  a.status,
  a.reason,
  a.notes,
  a.created_by       AS "createdBy",
  a.created_at       AS "createdAt",
  a.updated_at       AS "updatedAt",
  p.full_name        AS "patientName",
  p.cin              AS "patientCin",
  p.phone            AS "patientPhone",
  u.full_name        AS "createdByName"
`;

const FROM_JOINS = `
  FROM appointments a
  JOIN patients p ON p.id = a.patient_id
  JOIN users u ON u.id = a.created_by
`;

/**
 * Verify there is no other *confirmed* appointment for this patient within the
 * configured conflict window. Must be called with a transaction client that
 * already holds a lock on the patient row (see create/updateStatus).
 */
async function assertNoConfirmedConflict(client, patientId, appointmentDate, excludeId = null) {
  const windowMs = env.appointmentConflictWindowMinutes * 60 * 1000;
  const lower = new Date(appointmentDate.getTime() - windowMs);
  const upper = new Date(appointmentDate.getTime() + windowMs);

  const { rows } = await client.query(
    `SELECT a.id, a.appointment_date AS "appointmentDate"
       FROM appointments a
      WHERE a.patient_id = $1
        AND a.status = 'confirmed'
        AND ($2::uuid IS NULL OR a.id <> $2::uuid)
        AND a.appointment_date > $3
        AND a.appointment_date < $4
      ORDER BY a.appointment_date ASC
      LIMIT 1`,
    [patientId, excludeId, lower, upper],
  );

  if (rows.length > 0) {
    throw AppError.conflict(
      `This patient already has a confirmed appointment within ${env.appointmentConflictWindowMinutes} minutes of the selected time`,
      {
        conflictingAppointmentId: rows[0].id,
        conflictingAppointmentDate: rows[0].appointmentDate,
      },
    );
  }
}

/**
 * Serialise all confirmed-appointment changes for a single patient by locking
 * the patient row. This makes the check + write sequence safe under concurrency.
 */
async function lockPatient(client, patientId) {
  const { rows } = await client.query('SELECT id FROM patients WHERE id = $1 FOR UPDATE', [
    patientId,
  ]);
  if (rows.length === 0) {
    throw AppError.notFound('Patient not found');
  }
}

async function create(data, createdBy) {
  const { patientId, appointmentDate, status, reason, notes } = data;

  return db.withTransaction(async (client) => {
    await lockPatient(client, patientId);

    if (status === 'confirmed') {
      await assertNoConfirmedConflict(client, patientId, appointmentDate);
    }

    const { rows } = await client.query(
      `INSERT INTO appointments
         (patient_id, appointment_date, status, reason, notes, created_by)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id`,
      [patientId, appointmentDate, status, reason, notes ?? null, createdBy],
    );

    return findById(rows[0].id, client);
  });
}

async function findById(id, client = db) {
  const { rows } = await client.query(
    `SELECT ${APPOINTMENT_COLUMNS} ${FROM_JOINS} WHERE a.id = $1`,
    [id],
  );
  return rows[0] || null;
}

/**
 * Paginated list with filters: date (YYYY-MM-DD), status, patientId and a
 * free-text search across the patient name, CIN and appointment reason.
 */
async function list({ date, status, patientId, search, page = 1, limit = 10 }) {
  const conditions = [];
  const values = [];

  if (date) {
    values.push(date);
    conditions.push(`a.appointment_date::date = $${values.length}::date`);
  }
  if (status) {
    values.push(status);
    conditions.push(`a.status = $${values.length}`);
  }
  if (patientId) {
    values.push(patientId);
    conditions.push(`a.patient_id = $${values.length}`);
  }
  if (search) {
    values.push(search);
    const idx = values.length;
    conditions.push(
      `(STRPOS(LOWER(p.full_name), LOWER($${idx})) > 0
        OR STRPOS(LOWER(p.cin), LOWER($${idx})) > 0
        OR STRPOS(LOWER(a.reason), LOWER($${idx})) > 0)`,
    );
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const { rows: countRows } = await db.query(
    `SELECT COUNT(*)::int AS total ${FROM_JOINS} ${where}`,
    values,
  );
  const total = countRows[0].total;

  const offset = (page - 1) * limit;
  const dataValues = [...values, limit, offset];
  const limitIdx = values.length + 1;
  const offsetIdx = values.length + 2;

  const { rows } = await db.query(
    `SELECT ${APPOINTMENT_COLUMNS}
     ${FROM_JOINS}
     ${where}
     ORDER BY a.appointment_date DESC
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

/**
 * Appointment totals by status, used by the status filter cards.
 */
async function counts() {
  const { rows } = await db.query(`
    SELECT
      COUNT(*)::int AS total,
      COUNT(*) FILTER (WHERE status = 'pending')::int AS pending,
      COUNT(*) FILTER (WHERE status = 'confirmed')::int AS confirmed,
      COUNT(*) FILTER (WHERE status = 'cancelled')::int AS cancelled
    FROM appointments
  `);
  return rows[0];
}

/**
 * All appointments for a patient (used on the patient details page).
 */
async function listByPatient(patientId) {
  const { rows } = await db.query(
    `SELECT ${APPOINTMENT_COLUMNS}
     ${FROM_JOINS}
     WHERE a.patient_id = $1
     ORDER BY a.appointment_date DESC`,
    [patientId],
  );
  return rows;
}

/**
 * Change the status of an appointment.
 * When moving to `confirmed`, re-check the 30 minute rule inside a transaction.
 */
async function updateStatus(id, status) {
  return db.withTransaction(async (client) => {
    const { rows: current } = await client.query(
      'SELECT id, patient_id AS "patientId", appointment_date AS "appointmentDate", status FROM appointments WHERE id = $1',
      [id],
    );

    if (current.length === 0) {
      throw AppError.notFound('Appointment not found');
    }

    const appointment = current[0];

    if (status === 'confirmed') {
      await lockPatient(client, appointment.patientId);
      await assertNoConfirmedConflict(
        client,
        appointment.patientId,
        appointment.appointmentDate,
        id,
      );
    }

    await client.query('UPDATE appointments SET status = $1 WHERE id = $2', [status, id]);

    return findById(id, client);
  });
}

module.exports = {
  create,
  findById,
  list,
  counts,
  listByPatient,
  updateStatus,
};
