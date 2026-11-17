'use strict';

const request = require('supertest');
const app = require('../src/app');
const db = require('../src/config/db');
const migrate = require('../src/db/migrate');
const seed = require('../src/db/seed');
const reset = require('../src/db/reset');

let adminToken;
let staffToken;

const uniqueCin = () => `T${Date.now().toString().slice(-6)}${Math.floor(Math.random() * 1000)}`;

async function login(email, password) {
  const res = await request(app).post('/api/auth/login').send({ email, password });
  return res;
}

beforeAll(async () => {
  await reset();
  await migrate();
  await seed();

  const admin = await login('admin@clinicflow.dev', 'Admin@123');
  adminToken = admin.body.data.token;

  const staff = await login('staff@clinicflow.dev', 'Staff@123');
  staffToken = staff.body.data.token;
});

afterAll(async () => {
  await db.closePool();
});

describe('Health & root', () => {
  it('GET /api/health returns ok', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('ok');
  });
});

describe('Authentication', () => {
  it('logs in with valid credentials and returns a token', async () => {
    const res = await login('admin@clinicflow.dev', 'Admin@123');
    expect(res.status).toBe(200);
    expect(res.body.data.token).toBeDefined();
    expect(res.body.data.user.role).toBe('admin');
    expect(res.body.data.user.passwordHash).toBeUndefined();
  });

  it('rejects invalid credentials with 401', async () => {
    const res = await login('admin@clinicflow.dev', 'wrong-password');
    expect(res.status).toBe(401);
  });

  it('validates the login payload (400/422)', async () => {
    const res = await request(app).post('/api/auth/login').send({ email: 'not-an-email' });
    expect([400, 422]).toContain(res.status);
  });

  it('GET /api/auth/me requires a token', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(401);
  });

  it('GET /api/auth/me returns the current user', async () => {
    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${staffToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.email).toBe('staff@clinicflow.dev');
  });

  it('rejects an invalid JWT on protected routes', async () => {
    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', 'Bearer not-a-real-token');
    expect(res.status).toBe(401);
  });
});

describe('Patients CRUD, search and pagination', () => {
  let patientId;

  it('requires authentication for patient routes', async () => {
    const res = await request(app).get('/api/patients');
    expect(res.status).toBe(401);
  });

  it('rejects a malformed patient UUID', async () => {
    const res = await request(app)
      .get('/api/patients/not-a-uuid')
      .set('Authorization', `Bearer ${staffToken}`);
    expect([400, 422]).toContain(res.status);
  });

  it('creates a patient (201)', async () => {
    const res = await request(app)
      .post('/api/patients')
      .set('Authorization', `Bearer ${staffToken}`)
      .send({
        fullName: 'Test Patient',
        cin: uniqueCin(),
        phone: '+212600000000',
        birthDate: '1990-05-05',
        address: '1 Test Street',
      });
    expect(res.status).toBe(201);
    expect(res.body.data.id).toBeDefined();
    patientId = res.body.data.id;
  });

  it('rejects a duplicate CIN with 409', async () => {
    const cin = uniqueCin();
    await request(app)
      .post('/api/patients')
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ fullName: 'Dup A', cin, phone: '+212600000001', birthDate: '1990-01-01' });

    const res = await request(app)
      .post('/api/patients')
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ fullName: 'Dup B', cin, phone: '+212600000002', birthDate: '1990-01-01' });
    expect(res.status).toBe(409);
  });

  it('validates patient input (422)', async () => {
    const res = await request(app)
      .post('/api/patients')
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ fullName: 'X', cin: '', phone: '', birthDate: 'not-a-date' });
    expect([400, 422]).toContain(res.status);
    expect(res.body.error.details.length).toBeGreaterThan(0);
  });

  it('lists patients with pagination meta', async () => {
    const res = await request(app)
      .get('/api/patients?page=1&limit=2')
      .set('Authorization', `Bearer ${staffToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeLessThanOrEqual(2);
    expect(res.body.meta).toMatchObject({ page: 1, limit: 2 });
    expect(res.body.meta.total).toBeGreaterThanOrEqual(5);
  });

  it('searches patients by full name and by CIN', async () => {
    const byName = await request(app)
      .get('/api/patients?search=Youssef')
      .set('Authorization', `Bearer ${staffToken}`);
    expect(byName.status).toBe(200);
    expect(byName.body.data.some((p) => p.fullName.includes('Youssef'))).toBe(true);

    const byCin = await request(app)
      .get('/api/patients?search=AB123456')
      .set('Authorization', `Bearer ${staffToken}`);
    expect(byCin.body.data.some((p) => p.cin === 'AB123456')).toBe(true);
  });

  it('gets a patient by id', async () => {
    const res = await request(app)
      .get(`/api/patients/${patientId}`)
      .set('Authorization', `Bearer ${staffToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.fullName).toBe('Test Patient');
    expect(Array.isArray(res.body.data.appointments)).toBe(true);
  });

  it('returns 404 for an unknown patient', async () => {
    const res = await request(app)
      .get('/api/patients/00000000-0000-0000-0000-000000000000')
      .set('Authorization', `Bearer ${staffToken}`);
    expect(res.status).toBe(404);
  });

  it('updates a patient', async () => {
    const res = await request(app)
      .put(`/api/patients/${patientId}`)
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ phone: '+212611111111' });
    expect(res.status).toBe(200);
    expect(res.body.data.phone).toBe('+212611111111');
  });

  it('forbids a staff member from deleting a patient (403)', async () => {
    const res = await request(app)
      .delete(`/api/patients/${patientId}`)
      .set('Authorization', `Bearer ${staffToken}`);
    expect(res.status).toBe(403);
  });

  it('allows an admin to delete a patient', async () => {
    const res = await request(app)
      .delete(`/api/patients/${patientId}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);

    const check = await request(app)
      .get(`/api/patients/${patientId}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(check.status).toBe(404);
  });

  it('cascades appointment deletion when a patient is deleted', async () => {
    const created = await request(app)
      .post('/api/patients')
      .set('Authorization', `Bearer ${staffToken}`)
      .send({
        fullName: 'Cascade Patient',
        cin: uniqueCin(),
        phone: '+212600000088',
        birthDate: '1992-02-02',
      });
    const cascadePatientId = created.body.data.id;

    const appointment = await request(app)
      .post('/api/appointments')
      .set('Authorization', `Bearer ${staffToken}`)
      .send({
        patientId: cascadePatientId,
        appointmentDate: '2032-01-01T09:00:00.000Z',
        reason: 'Will be cascaded',
      });
    expect(appointment.status).toBe(201);

    const deleted = await request(app)
      .delete(`/api/patients/${cascadePatientId}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(deleted.status).toBe(200);

    const remaining = await request(app)
      .get(`/api/appointments?patientId=${cascadePatientId}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(remaining.status).toBe(200);
    expect(remaining.body.meta.total).toBe(0);
  });
});

describe('Appointments and the 30 minute business rule', () => {
  let patientA;
  let patientB;

  beforeAll(async () => {
    const a = await request(app)
      .post('/api/patients')
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ fullName: 'Appt Patient A', cin: uniqueCin(), phone: '+212600000010', birthDate: '1985-03-03' });
    patientA = a.body.data.id;

    const b = await request(app)
      .post('/api/patients')
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ fullName: 'Appt Patient B', cin: uniqueCin(), phone: '+212600000011', birthDate: '1985-03-03' });
    patientB = b.body.data.id;
  });

  it('creates a pending appointment (201)', async () => {
    const res = await request(app)
      .post('/api/appointments')
      .set('Authorization', `Bearer ${staffToken}`)
      .send({
        patientId: patientA,
        appointmentDate: '2030-01-01T10:00:00.000Z',
        reason: 'Consultation',
      });
    expect(res.status).toBe(201);
    expect(res.body.data.status).toBe('pending');
  });

  it('creates a confirmed appointment', async () => {
    const res = await request(app)
      .post('/api/appointments')
      .set('Authorization', `Bearer ${staffToken}`)
      .send({
        patientId: patientA,
        appointmentDate: '2030-02-01T10:00:00.000Z',
        status: 'confirmed',
        reason: 'Check-up',
      });
    expect(res.status).toBe(201);
    expect(res.body.data.status).toBe('confirmed');
  });

  it('rejects a second confirmed appointment within 30 minutes (409)', async () => {
    const res = await request(app)
      .post('/api/appointments')
      .set('Authorization', `Bearer ${staffToken}`)
      .send({
        patientId: patientA,
        appointmentDate: '2030-02-01T10:10:00.000Z',
        status: 'confirmed',
        reason: 'Too close',
      });
    expect(res.status).toBe(409);
  });

  it('allows a confirmed appointment exactly 30 minutes later', async () => {
    const res = await request(app)
      .post('/api/appointments')
      .set('Authorization', `Bearer ${staffToken}`)
      .send({
        patientId: patientA,
        appointmentDate: '2030-02-01T10:30:00.000Z',
        status: 'confirmed',
        reason: 'Edge case ok',
      });
    expect(res.status).toBe(201);
  });

  it('allows pending appointments inside the window (only confirmed conflict)', async () => {
    const res = await request(app)
      .post('/api/appointments')
      .set('Authorization', `Bearer ${staffToken}`)
      .send({
        patientId: patientA,
        appointmentDate: '2030-02-01T10:05:00.000Z',
        status: 'pending',
        reason: 'Pending is fine',
      });
    expect(res.status).toBe(201);
  });

  it('blocks confirming an appointment that conflicts with an existing confirmed one (409)', async () => {
    const created = await request(app)
      .post('/api/appointments')
      .set('Authorization', `Bearer ${staffToken}`)
      .send({
        patientId: patientB,
        appointmentDate: '2030-03-01T09:00:00.000Z',
        reason: 'Will be confirmed',
      });
    const id = created.body.data.id;

    const firstConfirm = await request(app)
      .patch(`/api/appointments/${id}/status`)
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ status: 'confirmed' });
    expect(firstConfirm.status).toBe(200);

    const conflicting = await request(app)
      .post('/api/appointments')
      .set('Authorization', `Bearer ${staffToken}`)
      .send({
        patientId: patientB,
        appointmentDate: '2030-03-01T09:20:00.000Z',
        reason: 'Conflicting one',
      });

    const res = await request(app)
      .patch(`/api/appointments/${conflicting.body.data.id}/status`)
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ status: 'confirmed' });
    expect(res.status).toBe(409);
  });

  it('filters appointments by status and date', async () => {
    const byStatus = await request(app)
      .get('/api/appointments?status=confirmed&limit=100')
      .set('Authorization', `Bearer ${staffToken}`);
    expect(byStatus.status).toBe(200);
    expect(byStatus.body.data.every((a) => a.status === 'confirmed')).toBe(true);

    const today = new Date().toISOString().slice(0, 10);
    const byDate = await request(app)
      .get(`/api/appointments?date=${today}&limit=100`)
      .set('Authorization', `Bearer ${staffToken}`);
    expect(byDate.status).toBe(200);
    byDate.body.data.forEach((a) => {
      expect(a.appointmentDate.slice(0, 10)).toBe(today);
    });
  });

  it('searches appointments by patient name, CIN, reason and combined filters', async () => {
    const token = `S${Date.now().toString().slice(-6)}`;
    const patient = await request(app)
      .post('/api/patients')
      .set('Authorization', `Bearer ${staffToken}`)
      .send({
        fullName: `Search Target ${token}`,
        cin: `SRCH${token}`,
        phone: '+212600000077',
        birthDate: '1988-06-06',
      });
    const searchPatientId = patient.body.data.id;

    const created = await request(app)
      .post('/api/appointments')
      .set('Authorization', `Bearer ${staffToken}`)
      .send({
        patientId: searchPatientId,
        appointmentDate: '2032-08-15T09:00:00.000Z',
        status: 'pending',
        reason: `Cardiology ${token}`,
      });
    expect(created.status).toBe(201);
    const appointmentId = created.body.data.id;

    const byName = await request(app)
      .get(`/api/appointments?search=${encodeURIComponent(`Search Target ${token}`)}&limit=100`)
      .set('Authorization', `Bearer ${staffToken}`);
    expect(byName.status).toBe(200);
    expect(byName.body.data.some((a) => a.id === appointmentId)).toBe(true);

    const byCin = await request(app)
      .get(`/api/appointments?search=${encodeURIComponent(`SRCH${token}`)}&limit=100`)
      .set('Authorization', `Bearer ${staffToken}`);
    expect(byCin.body.data.some((a) => a.id === appointmentId)).toBe(true);

    const byReason = await request(app)
      .get(`/api/appointments?search=${encodeURIComponent(`Cardiology ${token}`)}&limit=100`)
      .set('Authorization', `Bearer ${staffToken}`);
    expect(byReason.body.data.some((a) => a.id === appointmentId)).toBe(true);

    const combined = await request(app)
      .get(
        `/api/appointments?search=${encodeURIComponent(
          `Search Target ${token}`,
        )}&status=pending&date=2032-08-15&limit=100`,
      )
      .set('Authorization', `Bearer ${staffToken}`);
    expect(combined.status).toBe(200);
    expect(combined.body.data).toHaveLength(1);
    expect(combined.body.data[0].id).toBe(appointmentId);

    const noMatch = await request(app)
      .get(`/api/appointments?search=${encodeURIComponent(`No match ${token}`)}&limit=100`)
      .set('Authorization', `Bearer ${staffToken}`);
    expect(noMatch.status).toBe(200);
    expect(noMatch.body.data).toHaveLength(0);
    expect(noMatch.body.meta.total).toBe(0);

    const cleanup = await request(app)
      .delete(`/api/patients/${searchPatientId}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(cleanup.status).toBe(200);
  });

  it('returns appointment counts by status', async () => {
    const res = await request(app)
      .get('/api/appointments/counts')
      .set('Authorization', `Bearer ${staffToken}`);
    expect(res.status).toBe(200);
    const counts = res.body.data;
    expect(counts.total).toBeGreaterThanOrEqual(10);
    expect(counts.total).toBe(counts.pending + counts.confirmed + counts.cancelled);
    expect(counts.pending).toBeGreaterThanOrEqual(0);
    expect(counts.confirmed).toBeGreaterThanOrEqual(0);
    expect(counts.cancelled).toBeGreaterThanOrEqual(0);
  });

  it('updates status to cancelled', async () => {
    const created = await request(app)
      .post('/api/appointments')
      .set('Authorization', `Bearer ${staffToken}`)
      .send({
        patientId: patientB,
        appointmentDate: '2030-04-01T12:00:00.000Z',
        reason: 'To cancel',
      });
    const res = await request(app)
      .patch(`/api/appointments/${created.body.data.id}/status`)
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ status: 'cancelled' });
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('cancelled');
  });

  it('rejects an invalid appointment status', async () => {
    const res = await request(app)
      .post('/api/appointments')
      .set('Authorization', `Bearer ${staffToken}`)
      .send({
        patientId: patientA,
        appointmentDate: '2030-05-01T10:00:00.000Z',
        status: 'done',
        reason: 'Invalid status',
      });
    expect([400, 422]).toContain(res.status);
  });

  it('returns 404 when creating an appointment for an unknown patient', async () => {
    const res = await request(app)
      .post('/api/appointments')
      .set('Authorization', `Bearer ${staffToken}`)
      .send({
        patientId: '00000000-0000-0000-0000-000000000000',
        appointmentDate: '2030-05-01T10:00:00.000Z',
        reason: 'Unknown patient',
      });
    expect(res.status).toBe(404);
  });

  it('requires authentication for appointments', async () => {
    const res = await request(app).get('/api/appointments');
    expect(res.status).toBe(401);
  });

  it('handles concurrent confirmations safely (only one wins)', async () => {
    const patient = await request(app)
      .post('/api/patients')
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ fullName: 'Concurrent Patient', cin: uniqueCin(), phone: '+212600000099', birthDate: '1990-01-01' });
    const patientId = patient.body.data.id;

    const times = ['2031-01-01T08:00:00.000Z', '2031-01-01T08:05:00.000Z', '2031-01-01T08:10:00.000Z'];
    const ids = [];
    for (const t of times) {
      const created = await request(app)
        .post('/api/appointments')
        .set('Authorization', `Bearer ${staffToken}`)
        .send({ patientId, appointmentDate: t, reason: 'Concurrent test' });
      ids.push(created.body.data.id);
    }

    const results = await Promise.all(
      ids.map((id) =>
        request(app)
          .patch(`/api/appointments/${id}/status`)
          .set('Authorization', `Bearer ${staffToken}`)
          .send({ status: 'confirmed' }),
      ),
    );

    const successes = results.filter((r) => r.status === 200);
    const conflicts = results.filter((r) => r.status === 409);
    expect(successes).toHaveLength(1);
    expect(conflicts).toHaveLength(2);
  });
});

describe('Dashboard statistics', () => {
  it('returns aggregate stats from the database', async () => {
    const res = await request(app)
      .get('/api/dashboard/stats')
      .set('Authorization', `Bearer ${staffToken}`);
    expect(res.status).toBe(200);
    const d = res.body.data;
    expect(d.totalPatients).toBeGreaterThanOrEqual(5);
    expect(typeof d.todayAppointments).toBe('number');
    expect(typeof d.pendingAppointments).toBe('number');
    expect(typeof d.confirmedAppointments).toBe('number');
  });
});
