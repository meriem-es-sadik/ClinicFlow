'use strict';

const bcrypt = require('bcrypt');
const db = require('../config/db');
const env = require('../config/env');

/**
 * Seed the database with the data required by the technical test:
 *   1 admin, 2 staff, 5 patients, 10 appointments (mixed statuses).
 *
 * Idempotent: truncates the tables first, then inserts deterministic data.
 */

function dayAt(offsetDays, hours, minutes = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  d.setHours(hours, minutes, 0, 0);
  return d;
}

async function seed() {
  const rounds = env.bcryptRounds;
  const [adminHash, staffHash] = await Promise.all([
    bcrypt.hash('Admin@123', rounds),
    bcrypt.hash('Staff@123', rounds),
  ]);

  const client = await db.getClient();
  try {
    await client.query('BEGIN');
    await client.query('TRUNCATE appointments, patients, users RESTART IDENTITY CASCADE');

    // --- Users -------------------------------------------------------------
    const users = [
      ['Dr. Sarah Bennett', 'admin@clinicflow.dev', adminHash, 'admin'],
      ['James Carter', 'staff@clinicflow.dev', staffHash, 'staff'],
      ['Emily Nguyen', 'staff2@clinicflow.dev', staffHash, 'staff'],
    ];

    const userIds = {};
    for (const [fullName, email, passwordHash, role] of users) {
      const { rows } = await client.query(
        `INSERT INTO users (full_name, email, password_hash, role)
         VALUES ($1, $2, $3, $4) RETURNING id`,
        [fullName, email, passwordHash, role],
      );
      userIds[email] = rows[0].id;
    }

    const adminId = userIds['admin@clinicflow.dev'];
    const staffId = userIds['staff@clinicflow.dev'];
    const staff2Id = userIds['staff2@clinicflow.dev'];

    // --- Patients ----------------------------------------------------------
    const patients = [
      ['Youssef El Amrani', 'AB123456', '+212600112233', '1988-04-12', '12 Rue Ibn Sina, Casablanca'],
      ['Fatima Zahra Benali', 'CD789012', '+212600223344', '1995-09-30', '45 Avenue Hassan II, Rabat'],
      ['Omar Tazi', 'EF345678', '+212600334455', '1979-01-22', null],
      ['Nadia Chraibi', 'GH901234', '+212600445566', '2001-07-05', '8 Boulevard Zerktouni, Marrakech'],
      ['Karim Idrissi', 'IJ567890', '+212600556677', '1969-11-17', '23 Rue de la Liberté, Fès'],
    ];

    const patientIds = [];
    for (const [fullName, cin, phone, birthDate, address] of patients) {
      const { rows } = await client.query(
        `INSERT INTO patients (full_name, cin, phone, birth_date, address)
         VALUES ($1, $2, $3, $4, $5) RETURNING id`,
        [fullName, cin, phone, birthDate, address],
      );
      patientIds.push(rows[0].id);
    }

    const [p1, p2, p3, p4, p5] = patientIds;

    // --- Appointments ------------------------------------------------------
    // A patient never has two confirmed appointments within 30 minutes.
    const appointments = [
      [p1, dayAt(0, 9, 0), 'confirmed', 'General check-up', 'Routine annual visit', adminId],
      [p1, dayAt(0, 10, 30), 'pending', 'Blood test follow-up', null, staffId],
      [p2, dayAt(0, 9, 30), 'confirmed', 'Dental cleaning', 'Sensitive teeth', staffId],
      [p2, dayAt(0, 11, 0), 'cancelled', 'X-ray', 'Patient rescheduled', staff2Id],
      [p3, dayAt(0, 14, 0), 'confirmed', 'Cardiology consultation', null, adminId],
      [p4, dayAt(1, 10, 0), 'confirmed', 'Vaccination', 'Seasonal flu shot', staffId],
      [p5, dayAt(1, 11, 30), 'pending', 'Physiotherapy', null, staff2Id],
      [p1, dayAt(2, 9, 0), 'confirmed', 'Blood pressure monitoring', null, adminId],
      [p3, dayAt(-1, 15, 0), 'confirmed', 'ECG review', 'Results within normal range', staffId],
      [p5, dayAt(0, 16, 30), 'pending', 'Nutrition advice', null, staff2Id],
    ];

    for (const [patientId, appointmentDate, status, reason, notes, createdBy] of appointments) {
      await client.query(
        `INSERT INTO appointments
           (patient_id, appointment_date, status, reason, notes, created_by)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [patientId, appointmentDate, status, reason, notes, createdBy],
      );
    }

    await client.query('COMMIT');
    console.log('[seed] inserted 3 users, 5 patients and 10 appointments');
    console.log('[seed] credentials:');
    console.log('        admin@clinicflow.dev  / Admin@123');
    console.log('        staff@clinicflow.dev  / Staff@123');
    console.log('        staff2@clinicflow.dev / Staff@123');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

if (require.main === module) {
  seed()
    .then(() => db.closePool())
    .then(() => process.exit(0))
    .catch(async (err) => {
      console.error('[seed] failed:', err.message);
      await db.closePool().catch(() => {});
      process.exit(1);
    });
}

module.exports = seed;
