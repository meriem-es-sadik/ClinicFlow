/**
 * Browser E2E smoke test for ClinicFlow.
 *
 * Prerequisites:
 *   - backend running on http://localhost:4000
 *   - frontend dev server running on http://localhost:5173
 *   - database seeded (`cd backend && npm run db:seed`)
 *   - Google Chrome or Microsoft Edge installed
 *
 * The test logs in through the UI, exercises the dashboard, patient search,
 * patient details, appointment filters/status updates, logout, staff
 * permissions and the mobile sidebar. It creates its own patient through the
 * API and deletes it at the end, so repeated runs do not accumulate data.
 *
 * Run from `frontend/`:
 *   npm run test:e2e
 *
 * Environment overrides:
 *   E2E_BASE_URL        default http://localhost:5173
 *   E2E_API_URL         default http://localhost:4000/api
 *   E2E_ADMIN_EMAIL     default admin@clinicflow.dev
 *   E2E_ADMIN_PASSWORD  default Admin@123
 *   E2E_STAFF_EMAIL     default staff@clinicflow.dev
 *   E2E_STAFF_PASSWORD  default Staff@123
 *   E2E_CHANNEL         browser channel, default chrome (falls back to msedge)
 *   E2E_EXECUTABLE_PATH explicit browser executable path
 *   E2E_HEADED=1        show the browser
 */

import { existsSync } from 'node:fs';
import { chromium } from 'playwright-core';

const BASE_URL = (process.env.E2E_BASE_URL || 'http://localhost:5173').replace(/\/$/, '');
const API_URL = (process.env.E2E_API_URL || 'http://localhost:4000/api').replace(/\/$/, '');
const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL || 'admin@clinicflow.dev';
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD || 'Admin@123';
const STAFF_EMAIL = process.env.E2E_STAFF_EMAIL || 'staff@clinicflow.dev';
const STAFF_PASSWORD = process.env.E2E_STAFF_PASSWORD || 'Staff@123';
const HEADLESS = process.env.E2E_HEADED !== '1';

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

  const res = await fetch(API_URL + path, {
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

async function assertReachable(url, label) {
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
  } catch (error) {
    throw new Error(
      `${label} is not reachable at ${url}. Start it first and retry (${error.message}).`,
    );
  }
}

function browserCandidates() {
  if (process.env.E2E_EXECUTABLE_PATH) {
    return [{ executablePath: process.env.E2E_EXECUTABLE_PATH }];
  }
  if (process.env.E2E_CHANNEL) {
    return [{ channel: process.env.E2E_CHANNEL }];
  }

  const attempts = [{ channel: 'chrome' }, { channel: 'msedge' }];
  const paths = [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    '/usr/bin/microsoft-edge',
  ];
  for (const executablePath of paths) {
    if (existsSync(executablePath)) attempts.push({ executablePath });
  }
  return attempts;
}

async function launchBrowser() {
  let lastError = null;
  for (const options of browserCandidates()) {
    try {
      return await chromium.launch({ headless: HEADLESS, ...options });
    } catch (error) {
      lastError = error;
    }
  }
  throw new Error(
    `Could not launch Chrome or Edge. Install one, or set E2E_EXECUTABLE_PATH. ${
      lastError?.message?.split('\n')[0] || ''
    }`,
  );
}

function uniqueSuffix() {
  return `${Date.now().toString().slice(-7)}${Math.floor(Math.random() * 90 + 10)}`;
}

const suffix = uniqueSuffix();
const patientName = `E2E Smoke ${suffix}`;
const patientCin = `E2E${suffix}`;
const pendingReason = `E2E pending ${suffix}`;
const confirmedReason = `E2E confirmed ${suffix}`;

// One year ahead so the appointments sort near the top of the list, and at
// 12:00/13:00 UTC so the date-only filter agrees with the database timezone in
// all common timezones.
const future = new Date();
future.setUTCDate(future.getUTCDate() + 365);
const appointmentDate = future.toISOString().slice(0, 10);
const pendingTime = `${appointmentDate}T12:00:00.000Z`;
const confirmedTime = `${appointmentDate}T13:00:00.000Z`;

let browser = null;
let adminToken = null;
let patientId = null;

try {
  await assertReachable(BASE_URL, 'Frontend');
  await assertReachable(`${API_URL}/health`, 'Backend API');

  // API setup -------------------------------------------------------------
  let res = await req('/auth/login', {
    method: 'POST',
    body: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
  });
  adminToken = res.body?.data?.token || null;
  if (res.status === 429) {
    throw new Error(
      'Login rate limit reached (20 attempts per 15 minutes). Wait for it to reset or restart the backend, then retry.',
    );
  }
  if (res.status !== 200 || !adminToken) {
    throw new Error(
      'Admin login failed through the API. Is the database seeded (`npm run db:seed`)?',
    );
  }

  res = await req('/patients', {
    method: 'POST',
    token: adminToken,
    body: {
      fullName: patientName,
      cin: patientCin,
      phone: '+212699000555',
      birthDate: '1992-04-12',
      address: 'E2E smoke address',
    },
  });
  patientId = res.body?.data?.id || null;
  if (res.status !== 201 || !patientId) {
    throw new Error(`Could not create the E2E patient: HTTP ${res.status}`);
  }

  res = await req('/appointments', {
    method: 'POST',
    token: adminToken,
    body: {
      patientId,
      appointmentDate: pendingTime,
      status: 'pending',
      reason: pendingReason,
    },
  });
  if (res.status !== 201) {
    throw new Error(`Could not create the pending E2E appointment: HTTP ${res.status}`);
  }

  res = await req('/appointments', {
    method: 'POST',
    token: adminToken,
    body: {
      patientId,
      appointmentDate: confirmedTime,
      status: 'confirmed',
      reason: confirmedReason,
    },
  });
  if (res.status !== 201) {
    throw new Error(`Could not create the confirmed E2E appointment: HTTP ${res.status}`);
  }

  // Browser ---------------------------------------------------------------
  browser = await launchBrowser();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const consoleErrors = [];
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  page.on('pageerror', (error) => consoleErrors.push(`PAGEERROR: ${error.message}`));

  // Invalid login (the expected 401 console noise is cleared afterwards).
  await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle' });
  check('login page renders', await page.getByRole('heading', { name: 'Sign in' }).isVisible());

  await page.locator('#email').fill(ADMIN_EMAIL);
  await page.locator('#password').fill('wrong-password');
  await page.getByRole('button', { name: 'Sign in' }).click();
  const alert = page.locator('.form__alert');
  await alert.waitFor({ state: 'visible', timeout: 10000 });
  const alertText = (await alert.textContent()).toLowerCase();
  if (alertText.includes('too many')) {
    throw new Error(
      'Login rate limit reached (20 attempts per 15 minutes). Wait for it to reset or restart the backend, then retry.',
    );
  }
  check('invalid credentials shows error', alertText.includes('invalid'));
  consoleErrors.length = 0;

  // Admin login + dashboard.
  await page.locator('#password').fill(ADMIN_PASSWORD);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.waitForURL('**/dashboard', { timeout: 15000 });
  await page.getByText('Total patients').waitFor({ state: 'visible', timeout: 15000 });
  check('admin login reaches dashboard', page.url().includes('/dashboard'));
  const cardCount = await page.locator('.stat-card').count();
  check('dashboard stat cards visible', cardCount === 4, `cards ${cardCount}`);

  // Language switching, persistence and RTL.
  await page.selectOption('#language-switcher', 'fr');
  await page.waitForFunction(() => document.documentElement.lang === 'fr');
  await page.getByRole('heading', { name: /Bonjour/ }).waitFor({ timeout: 10000 });
  check('language switcher changes the UI to French', true);

  await page.selectOption('#language-switcher', 'ar');
  await page.waitForFunction(
    () => document.documentElement.dir === 'rtl' && document.body.classList.contains('rtl'),
  );
  await page.getByRole('heading', { name: /مرحب/ }).waitFor({ timeout: 10000 });
  check('Arabic activates the RTL layout', true);

  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForFunction(() => document.documentElement.dir === 'rtl');
  check('language choice persists after reload', page.url().includes('/dashboard'));

  await page.selectOption('#language-switcher', 'en');
  await page.waitForFunction(() => document.documentElement.lang === 'en');
  await page.getByText('Total patients').waitFor({ state: 'visible', timeout: 15000 });
  check('language switcher restores English', true);

  // Patient search + admin delete action.
  await page.getByRole('link', { name: 'Patients' }).click();
  await page.waitForURL('**/patients');
  await page.locator('input[aria-label="Search patients"]').fill(patientName);
  await page.waitForFunction(
    (name) => {
      const rows = Array.from(document.querySelectorAll('table tbody tr'));
      return rows.length === 1 && rows[0].textContent.includes(name);
    },
    patientName,
    { timeout: 15000 },
  );
  await page.getByRole('link', { name: patientName, exact: true }).waitFor({ timeout: 15000 });
  check('patient search returns only the E2E patient', true);

  const adminDeleteButtons = await page.locator('button[aria-label^="Delete "]').count();
  check('admin sees delete actions', adminDeleteButtons > 0, `buttons ${adminDeleteButtons}`);

  // Patient details.
  await page.getByRole('link', { name: patientName, exact: true }).click();
  await page.waitForURL('**/patients/*');
  await page.getByRole('heading', { name: patientName }).waitFor({ timeout: 15000 });
  check('patient details shows information', await page.getByRole('heading', { name: 'Patient information' }).isVisible());
  check('patient details shows appointment history', await page.getByRole('heading', { name: 'Appointment history' }).isVisible());
  const historyRows = await page.locator('.panel .table tbody tr').count();
  check('patient history has rows', historyRows >= 2, `rows ${historyRows}`);

  // Appointment search, counts, filters + status update.
  await page.getByRole('link', { name: 'Appointments' }).click();
  await page.waitForURL('**/appointments');
  await page.locator('.appointment-card').first().waitFor({ timeout: 15000 });
  await page.waitForFunction(
    () =>
      Array.from(document.querySelectorAll('.appointment-stat__value')).every(
        (element) => element.textContent.trim() !== '—',
      ),
    null,
    { timeout: 15000 },
  );
  const statValues = await page.locator('.appointment-stat__value').allTextContents();
  check(
    'appointment status cards show counts',
    statValues.length === 4 && statValues.every((value) => value.trim() !== '—'),
    statValues.join(','),
  );

  const appointmentSearch = page.locator('input[aria-label="Search appointments"]');
  await appointmentSearch.fill(pendingReason);
  await page.waitForFunction(
    (reason) => {
      const cards = Array.from(document.querySelectorAll('.appointment-card'));
      return cards.length === 1 && cards[0].textContent.includes(reason);
    },
    pendingReason,
    { timeout: 15000 },
  );
  check('appointment search finds the pending E2E appointment', true);

  await appointmentSearch.fill('');
  await page.waitForFunction(
    () => document.querySelectorAll('.appointment-card').length >= 2,
    null,
    { timeout: 15000 },
  );

  await page.getByRole('button', { name: 'Filter by Pending' }).click();
  await page.waitForTimeout(800);
  const badges = await page.locator('.appointment-card .badge').allTextContents();
  check(
    'appointment status filter works',
    badges.length > 0 && badges.every((badge) => badge.trim() === 'Pending'),
    badges.join(','),
  );

  const pendingCard = page.locator('.appointment-card', { hasText: pendingReason });
  await pendingCard.waitFor({ timeout: 15000 });
  await pendingCard.getByRole('button', { name: 'Confirm' }).click();
  const toast = page.locator('.toast--success', { hasText: 'Appointment confirmed' });
  await toast.first().waitFor({ state: 'visible', timeout: 15000 });
  check(
    'appointment status update shows success toast',
    (await toast.first().textContent()).toLowerCase().includes('confirmed'),
  );

  await page.getByRole('button', { name: 'Filter by All appointments' }).click();
  await page.waitForTimeout(600);
  await page.locator('input[aria-label="Filter by date"]').fill(appointmentDate);
  await page.waitForTimeout(800);
  const dateCards = await page.locator('.appointment-card').count();
  check('appointment date filter returns cards', dateCards > 0, `cards ${dateCards}`);

  // Logout.
  await page.getByRole('button', { name: 'Sign out' }).click();
  await page.waitForURL('**/login', { timeout: 15000 });
  check('logout redirects to login', page.url().includes('/login'));

  // Staff permissions.
  await page.locator('#email').fill(STAFF_EMAIL);
  await page.locator('#password').fill(STAFF_PASSWORD);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.waitForURL(/\/(dashboard|appointments)$/, { timeout: 15000 });
  await page.getByRole('link', { name: 'Patients' }).click();
  await page.waitForURL('**/patients');
  await page.locator('input[aria-label="Search patients"]').fill(patientName);
  await page.waitForFunction(
    (name) => {
      const rows = Array.from(document.querySelectorAll('table tbody tr'));
      return rows.length === 1 && rows[0].textContent.includes(name);
    },
    patientName,
    { timeout: 15000 },
  );
  const staffDeleteButtons = await page.locator('button[aria-label^="Delete "]').count();
  check('staff cannot see delete actions', staffDeleteButtons === 0, `buttons ${staffDeleteButtons}`);

  // Mobile responsive menu.
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(400);
  const menuButton = page.getByRole('button', { name: 'Open menu' });
  check('mobile menu button visible', await menuButton.isVisible());
  await menuButton.click();
  await page.waitForTimeout(400);
  const sidebarOpen = await page
    .locator('aside.sidebar')
    .evaluate((element) => element.className.includes('sidebar--open'));
  check('mobile sidebar opens', sidebarOpen);

  check(
    'no console/page errors',
    consoleErrors.length === 0,
    consoleErrors.slice(0, 5).join(' | '),
  );
} catch (error) {
  fail += 1;
  results.push(`FAIL  unexpected error -> ${(error.message || String(error)).split('\n')[0]}`);
} finally {
  if (browser) {
    await browser.close().catch(() => {});
  }
  if (patientId && adminToken) {
    try {
      const cleanup = await req(`/patients/${patientId}`, {
        method: 'DELETE',
        token: adminToken,
      });
      if (cleanup.status === 200) {
        results.push('INFO  cleaned up the E2E patient and its appointments');
      }
    } catch {
      // Cleanup is best-effort.
    }
  }

  console.log(results.join('\n'));
  console.log(`\nE2E SMOKE RESULT: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}
