'use strict';

/**
 * Live HTTP smoke test against a running ClinicFlow API.
 *
 * The script is self-contained: it creates its own patient (and related
 * appointments), exercises the main endpoints, then deletes the patient so the
 * database is left as it was found. Run the API first, then:
 *
 *   npm run test:smoke
 *
 * Environment overrides:
 *   API_SMOKE_BASE_URL       default http://localhost:4000/api
 *   API_SMOKE_ADMIN_EMAIL    default admin@clinicflow.dev
 *   API_SMOKE_ADMIN_PASSWORD default Admin@123
 *   API_SMOKE_STAFF_EMAIL    default staff@clinicflow.dev
 *   API_SMOKE_STAFF_PASSWORD default Staff@123
 */

const BASE = (process.env.API_SMOKE_BASE_URL || 'http://localhost:4000/api').replace(/\/$/, '');
const ADMIN_EMAIL = process.env.API_SMOKE_ADMIN_EMAIL || 'admin@clinicflow.dev';
const ADMIN_PASSWORD = process.env.API_SMOKE_ADMIN_PASSWORD || 'Admin@123';
const STAFF_EMAIL = process.env.API_SMOKE_STAFF_EMAIL || 'staff@clinicflow.dev';
const STAFF_PASSWORD = process.env.API_SMOKE_STAFF_PASSWORD || 'Staff@123';

let pass = 0;
let fail = 0;
const results = [];

function check(name, condition, extra = '') {
  if (condition) {
    pass += 1;
    results.push(`PASS  ${name}${extra ? ` -> ${extra}` : ''}`);
  } else {
    fail += 1;
    results.push(`FAIL  ${name}${extra ? ` -> ${extra}` : ''}`);
  }
}

async function req(path, { method = 'GET', token, body } = {}) {
  const headers = { Accept: 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers['Content-Type'] = 'application/json';

  const res = await fetch(BASE + path, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const contentType = res.headers.get('content-type') || '';
  const payload = contentType.includes('application/json')
    ? await res.json().catch(() => null)
    : null;

  return { status: res.status, body: payload };
}

function uniqueSuffix() {
  return `${Date.now().toString().slice(-7)}${Math.floor(Math.random() * 90 + 10)}`;
}

(async () => {
  let adminToken = null;
  let staffToken = null;
  let patientId = null;
  let cleanedUp = false;

  try {
    // Health -----------------------------------------------------------------
    let r = await req('/health');
    check('GET /api/health', r.status === 200 && r.body?.data?.status === 'ok', `status ${r.status}`);

    // Authentication ---------------------------------------------------------
    r = await req('/auth/login', {
      method: 'POST',
      body: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
    });
    adminToken = r.body?.data?.token || null;
    if (r.status === 429) {
      throw new Error(
        'Login rate limit reached (20 attempts per 15 minutes). Wait for it to reset or restart the backend, then retry.',
      );
    }
    check(
      'admin login',
      r.status === 200 && Boolean(adminToken) && r.body?.data?.user?.role === 'admin',
      `status ${r.status}`,
    );

    r = await req('/auth/login', {
      method: 'POST',
      body: { email: STAFF_EMAIL, password: STAFF_PASSWORD },
    });
    staffToken = r.body?.data?.token || null;
    check(
      'staff login',
      r.status === 200 && Boolean(staffToken) && r.body?.data?.user?.role === 'staff',
      `status ${r.status}`,
    );

    r = await req('/auth/login', {
      method: 'POST',
      body: { email: ADMIN_EMAIL, password: 'wrong-password' },
    });
    check('invalid credentials -> 401', r.status === 401, `status ${r.status}`);

    r = await req('/auth/login', { method: 'POST', body: { email: 'bad-email' } });
    check('invalid login payload -> 422', r.status === 422, `status ${r.status}`);

    r = await req('/auth/me', { token: adminToken });
    check(
      'GET /api/auth/me',
      r.status === 200 && r.body?.data?.email === ADMIN_EMAIL,
      `status ${r.status}`,
    );

    r = await req('/auth/me', { token: 'invalid.token.value' });
    check('invalid JWT -> 401', r.status === 401, `status ${r.status}`);

    r = await req('/patients');
    check('protected route without token -> 401', r.status === 401, `status ${r.status}`);

    if (!adminToken || !staffToken) {
      throw new Error(
        'Could not log in with the seeded accounts. Start the API and run `npm run db:seed` first.',
      );
    }

    // Patients ---------------------------------------------------------------
    const suffix = uniqueSuffix();
    const cin = `SMK${suffix}`;
    const fullName = `API Smoke Patient ${suffix}`;

    r = await req('/patients', {
      method: 'POST',
      token: staffToken,
      body: {
        fullName,
        cin,
        phone: '+212699000111',
        birthDate: '1991-03-14',
        address: 'Smoke test street',
      },
    });
    patientId = r.body?.data?.id || null;
    check('create patient', r.status === 201 && Boolean(patientId), `status ${r.status}`);

    r = await req('/patients', {
      method: 'POST',
      token: staffToken,
      body: { fullName: 'Duplicate CIN', cin, phone: '+212699000112', birthDate: '1991-03-14' },
    });
    check('duplicate CIN -> 409', r.status === 409, `status ${r.status}`);

    r = await req('/patients', {
      method: 'POST',
      token: staffToken,
      body: { fullName: 'X', cin: '', phone: '', birthDate: 'bad' },
    });
    check(
      'invalid patient -> 422',
      r.status === 422 && Array.isArray(r.body?.error?.details),
      `status ${r.status}`,
    );

    r = await req('/patients?page=1&limit=2', { token: staffToken });
    check(
      'patients pagination',
      r.status === 200 && Array.isArray(r.body?.data) && r.body.data.length <= 2 && r.body?.meta?.limit === 2,
      `total ${r.body?.meta?.total}`,
    );

    r = await req('/patients?search=API%20Smoke', { token: staffToken });
    check(
      'patient search by name',
      r.status === 200 && r.body.data.some((p) => p.fullName === fullName),
      `hits ${r.body?.data?.length}`,
    );

    r = await req(`/patients?search=${encodeURIComponent(cin)}`, { token: staffToken });
    check(
      'patient search by CIN',
      r.status === 200 && r.body.data.some((p) => p.cin === cin),
      `hits ${r.body?.data?.length}`,
    );

    r = await req(`/patients/${patientId}`, { token: staffToken });
    check(
      'patient details + appointment history',
      r.status === 200 && Array.isArray(r.body?.data?.appointments),
      `status ${r.status}`,
    );

    r = await req(`/patients/${patientId}`, {
      method: 'PUT',
      token: staffToken,
      body: { phone: '+212699000999' },
    });
    check(
      'update patient',
      r.status === 200 && r.body?.data?.phone === '+212699000999',
      `status ${r.status}`,
    );

    r = await req(`/patients/${patientId}`, { method: 'DELETE', token: staffToken });
    check('staff delete forbidden -> 403', r.status === 403, `status ${r.status}`);

    r = await req('/patients/not-a-uuid', { token: staffToken });
    check('malformed UUID -> 422', r.status === 422, `status ${r.status}`);

    r = await req('/patients/00000000-0000-0000-0000-000000000000', { token: staffToken });
    check('unknown patient -> 404', r.status === 404, `status ${r.status}`);

    // Appointments -----------------------------------------------------------
    r = await req('/appointments', {
      method: 'POST',
      token: staffToken,
      body: {
        patientId,
        appointmentDate: '2033-05-05T09:00:00.000Z',
        status: 'confirmed',
        reason: 'Smoke confirmed',
      },
    });
    check(
      'create confirmed appointment',
      r.status === 201 && r.body?.data?.status === 'confirmed',
      `status ${r.status}`,
    );
    const confirmedId = r.body?.data?.id;

    r = await req('/appointments', {
      method: 'POST',
      token: staffToken,
      body: {
        patientId,
        appointmentDate: '2033-05-05T09:20:00.000Z',
        status: 'confirmed',
        reason: 'Conflict',
      },
    });
    check('confirmed conflict within 30 min -> 409', r.status === 409, `status ${r.status}`);

    r = await req('/appointments', {
      method: 'POST',
      token: staffToken,
      body: {
        patientId,
        appointmentDate: '2033-05-05T09:30:00.000Z',
        status: 'confirmed',
        reason: 'Exactly 30 min',
      },
    });
    check('confirmed exactly 30 min apart allowed', r.status === 201, `status ${r.status}`);

    r = await req('/appointments', {
      method: 'POST',
      token: staffToken,
      body: {
        patientId,
        appointmentDate: '2033-05-05T09:10:00.000Z',
        status: 'pending',
        reason: 'Pending inside window',
      },
    });
    check('pending inside window allowed', r.status === 201, `status ${r.status}`);
    const pendingId = r.body?.data?.id;

    r = await req(`/appointments/${pendingId}/status`, {
      method: 'PATCH',
      token: staffToken,
      body: { status: 'confirmed' },
    });
    check('confirm pending conflict -> 409', r.status === 409, `status ${r.status}`);

    r = await req(`/appointments/${pendingId}/status`, {
      method: 'PATCH',
      token: staffToken,
      body: { status: 'cancelled' },
    });
    check(
      'cancel appointment',
      r.status === 200 && r.body?.data?.status === 'cancelled',
      `status ${r.status}`,
    );

    r = await req(`/appointments/${confirmedId}/status`, {
      method: 'PATCH',
      token: staffToken,
      body: { status: 'pending' },
    });
    check(
      'confirmed -> pending',
      r.status === 200 && r.body?.data?.status === 'pending',
      `status ${r.status}`,
    );

    r = await req('/appointments?status=confirmed&limit=100', { token: staffToken });
    check(
      'filter appointments by status',
      r.status === 200 && r.body.data.every((a) => a.status === 'confirmed'),
      `count ${r.body?.data?.length}`,
    );

    r = await req('/appointments?date=2033-05-05&limit=100', { token: staffToken });
    check(
      'filter appointments by date',
      r.status === 200 &&
        r.body.data.length > 0 &&
        r.body.data.every((a) => a.appointmentDate.slice(0, 10) === '2033-05-05'),
      `count ${r.body?.data?.length}`,
    );

    r = await req(`/appointments?search=${encodeURIComponent(fullName)}&limit=100`, {
      token: staffToken,
    });
    check(
      'appointment search by patient name',
      r.status === 200 && r.body.data.some((a) => a.patientName === fullName),
      `hits ${r.body?.data?.length}`,
    );

    r = await req(`/appointments?search=${encodeURIComponent(cin)}&limit=100`, {
      token: staffToken,
    });
    check(
      'appointment search by patient CIN',
      r.status === 200 && r.body.data.some((a) => a.patientCin === cin),
      `hits ${r.body?.data?.length}`,
    );

    r = await req('/appointments?search=Smoke%20confirmed&limit=100', { token: staffToken });
    check(
      'appointment search by reason',
      r.status === 200 &&
        r.body.data.length > 0 &&
        r.body.data.every((a) => a.reason.includes('Smoke confirmed')),
      `hits ${r.body?.data?.length}`,
    );

    r = await req('/appointments/counts', { token: staffToken });
    check(
      'appointment counts by status',
      r.status === 200 &&
        typeof r.body.data.total === 'number' &&
        r.body.data.total ===
          r.body.data.pending + r.body.data.confirmed + r.body.data.cancelled,
      JSON.stringify(r.body?.data),
    );

    r = await req('/appointments', {
      method: 'POST',
      token: staffToken,
      body: {
        patientId: '00000000-0000-0000-0000-000000000000',
        appointmentDate: '2033-07-01T09:00:00.000Z',
        reason: 'Unknown patient',
      },
    });
    check('appointment unknown patient -> 404', r.status === 404, `status ${r.status}`);

    r = await req('/appointments', {
      method: 'POST',
      token: staffToken,
      body: {
        patientId,
        appointmentDate: '2033-07-01T09:00:00.000Z',
        status: 'done',
        reason: 'Bad status',
      },
    });
    check('invalid appointment status -> 422', r.status === 422, `status ${r.status}`);

    // Concurrent confirmations must be serialised by the backend.
    const concurrentTimes = [
      '2033-06-01T08:00:00.000Z',
      '2033-06-01T08:05:00.000Z',
      '2033-06-01T08:10:00.000Z',
    ];
    const concurrentIds = [];
    for (const appointmentDate of concurrentTimes) {
      const created = await req('/appointments', {
        method: 'POST',
        token: staffToken,
        body: { patientId, appointmentDate, reason: 'Concurrent smoke' },
      });
      concurrentIds.push(created.body?.data?.id);
    }
    const outcomes = await Promise.all(
      concurrentIds.map((id) =>
        req(`/appointments/${id}/status`, {
          method: 'PATCH',
          token: staffToken,
          body: { status: 'confirmed' },
        }),
      ),
    );
    const wins = outcomes.filter((o) => o.status === 200).length;
    const conflicts = outcomes.filter((o) => o.status === 409).length;
    check(
      'concurrent confirmations only one wins',
      wins === 1 && conflicts === 2,
      `200s=${wins}, 409s=${conflicts}, other=${outcomes
        .filter((o) => o.status !== 200 && o.status !== 409)
        .map((o) => o.status)
        .join(',')}`,
    );

    // Dashboard --------------------------------------------------------------
    r = await req('/dashboard/stats', { token: staffToken });
    check(
      'dashboard stats',
      r.status === 200 &&
        typeof r.body.data.totalPatients === 'number' &&
        typeof r.body.data.todayAppointments === 'number' &&
        typeof r.body.data.pendingAppointments === 'number' &&
        typeof r.body.data.confirmedAppointments === 'number',
      JSON.stringify(r.body?.data),
    );

    // Admin delete + cascade -------------------------------------------------
    r = await req(`/patients/${patientId}`, { method: 'DELETE', token: adminToken });
    if (r.status === 200) cleanedUp = true;
    check('admin delete patient', r.status === 200, `status ${r.status}`);

    r = await req(`/appointments?patientId=${patientId}`, { token: adminToken });
    check(
      'appointments cascaded on patient delete',
      r.status === 200 && r.body?.meta?.total === 0,
      `remaining ${r.body?.meta?.total}`,
    );

    r = await req(`/patients/${patientId}`, { token: adminToken });
    check('deleted patient -> 404', r.status === 404, `status ${r.status}`);
  } finally {
    if (!cleanedUp && patientId && adminToken) {
      try {
        await req(`/patients/${patientId}`, { method: 'DELETE', token: adminToken });
      } catch {
        // Cleanup is best-effort.
      }
    }

    console.log(results.join('\n'));
    console.log(`\nAPI SMOKE RESULT: ${pass} passed, ${fail} failed`);
  }

  process.exit(fail ? 1 : 0);
})().catch((error) => {
  console.error('API SMOKE SCRIPT ERROR:', error.message || error);
  process.exit(2);
});
