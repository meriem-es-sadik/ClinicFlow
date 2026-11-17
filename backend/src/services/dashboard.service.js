'use strict';

const db = require('../config/db');

/**
 * Aggregate statistics for the dashboard. All values are computed in
 * PostgreSQL so the numbers are always consistent with the stored data.
 */
async function getStats() {
  const { rows } = await db.query(`
    SELECT
      (SELECT COUNT(*)::int FROM patients) AS "totalPatients",
      (SELECT COUNT(*)::int FROM appointments
        WHERE appointment_date::date = CURRENT_DATE) AS "todayAppointments",
      (SELECT COUNT(*)::int FROM appointments
        WHERE status = 'pending') AS "pendingAppointments",
      (SELECT COUNT(*)::int FROM appointments
        WHERE status = 'confirmed') AS "confirmedAppointments",
      (SELECT COUNT(*)::int FROM appointments
        WHERE status = 'cancelled') AS "cancelledAppointments",
      (SELECT COUNT(*)::int FROM appointments) AS "totalAppointments"
  `);

  return rows[0];
}

/**
 * The next upcoming appointments (from now on), used as a dashboard panel.
 */
async function getUpcoming(limit = 5) {
  const { rows } = await db.query(
    `SELECT
        a.id,
        a.appointment_date AS "appointmentDate",
        a.status,
        a.reason,
        p.id        AS "patientId",
        p.full_name AS "patientName",
        p.cin       AS "patientCin"
       FROM appointments a
       JOIN patients p ON p.id = a.patient_id
      WHERE a.appointment_date >= now()
        AND a.status <> 'cancelled'
      ORDER BY a.appointment_date ASC
      LIMIT $1`,
    [limit],
  );
  return rows;
}

module.exports = { getStats, getUpcoming };
