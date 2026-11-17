# ClinicFlow

ClinicFlow is a small PERN (PostgreSQL + Express + React + Node) application for
managing patients, appointments and clinic users. It was built for the
ClinicFlow technical test.

- Backend: Node.js, Express, PostgreSQL (`pg`), JWT, bcrypt, Zod
- Frontend: React 18, React Router, Vite, lucide-react
- Database design: [`docs/DATABASE.md`](docs/DATABASE.md)

## Features

### Authentication and roles
- Email + password login with bcrypt password hashing.
- JWT access tokens (`Authorization: Bearer <token>`).
- `admin` and `staff` roles.
- Admin-only patient deletion; all other required actions are available to both
  roles.
- Authenticated `GET /api/auth/me`.
- Login rate limiting.

### Patients
- Create, read, update and delete patient records.
- Required fields: full name, CIN, phone, birth date.
- Optional address.
- Unique CIN (database constraint).
- Paginated list with search by full name or CIN.
- Patient details include the full appointment history.

### Appointments
- Create appointments with patient, date/time, status, reason and notes.
- Track who created each appointment.
- Filter by date, status and patient.
- Update appointment status (`pending`, `confirmed`, `cancelled`).
- Mandatory business rule: a patient cannot have two confirmed appointments
  within a 30-minute window.

### Dashboard
- Total patients.
- Appointments scheduled today.
- Pending appointment count.
- Confirmed appointment count.
- Upcoming appointments panel.

### Frontend
- Login page with demo account shortcuts.
- Dashboard with live statistics and upcoming appointments.
- Patients list with search, pagination and add/edit/delete actions.
- Patient details with appointment history and quick appointment creation.
- Appointments list with date/status filters, pagination, create and status
  updates.
- Loading, empty and error states.
- Responsive layout.
- Role-aware UI (staff cannot see the delete action).

## Project structure

```
ClinicFlow-test/
├── backend/
│   ├── src/
│   │   ├── config/        # env + PostgreSQL pool
│   │   ├── controllers/   # HTTP layer
│   │   ├── db/            # schema.sql, migrate, reset, seed
│   │   ├── middleware/    # auth, roles, validation, errors
│   │   ├── routes/        # Express routers
│   │   ├── services/      # business logic + SQL
│   │   ├── utils/         # AppError, JWT, async wrapper
│   │   └── validators/    # Zod schemas
│   ├── tests/             # Jest + Supertest API tests
│   └── scripts/
│       └── api-smoke.js   # live HTTP smoke test
├── frontend/
│   ├── e2e/
│   │   └── smoke.mjs      # browser E2E smoke test
│   └── src/
│       ├── api/           # fetch client + endpoint wrappers
│       ├── components/    # forms, tables, modals, layout
│       ├── context/       # auth + toasts
│       ├── pages/         # Login, Dashboard, Patients, Appointments
│       └── utils/         # formatting helpers
├── docs/
│   └── DATABASE.md        # ERD + design justification
├── ClinicFlow-test (5) (1).pdf
└── README.md
```

## Prerequisites

- Node.js 18 or newer (tested with Node 24).
- PostgreSQL 14 or newer (tested with PostgreSQL 17).
- npm.

## 1. Install dependencies

```bash
cd backend
npm install

cd ../frontend
npm install
```

## 2. Create the PostgreSQL database

Make sure PostgreSQL is running, then create a database (for example
`clinicflow`):

```bash
psql -U postgres -h localhost -c "CREATE DATABASE clinicflow;"
```

If the database already exists, PostgreSQL returns an error and you can ignore
it.

### Windows note

If `psql` is not on your `PATH`, use the full path to the binary. For a standard
PostgreSQL installation:

```powershell
& "C:\Program Files\PostgreSQL\17\bin\psql.exe" -U postgres -h localhost -c "CREATE DATABASE clinicflow;"
```

## 3. Configure the backend

Copy the example environment file and adjust it:

```bash
cd backend
cp .env.example .env
```

On Windows PowerShell:

```powershell
Copy-Item .env.example .env
```

`backend/.env.example`:

```dotenv
NODE_ENV=development
PORT=4000

PGHOST=localhost
PGPORT=5432
PGUSER=postgres
PGPASSWORD=postgres
PGDATABASE=clinicflow
PGSSL=false

JWT_SECRET=change-me-to-a-long-random-secret-string
JWT_EXPIRES_IN=8h
BCRYPT_ROUNDS=10

CORS_ORIGIN=http://localhost:5173
APPOINTMENT_CONFLICT_WINDOW_MINUTES=30
```

Set `JWT_SECRET` to a long random value for anything other than local
development. The backend refuses to start in production with the placeholder
secret.

## 4. Initialize and seed the database

From `backend/`:

```bash
npm run db:migrate   # safe, idempotent schema migration (does not delete data)
npm run db:seed      # deterministic demo data (truncates application tables)
```

Or run both in one command:

```bash
npm run db:setup
```

For a clean local reset (drops application tables, migrates and seeds again):

```bash
npm run db:reset
```

### Seed data

Seed accounts:

| Role | Email | Password |
| --- | --- | --- |
| Admin | `admin@clinicflow.dev` | `Admin@123` |
| Staff | `staff@clinicflow.dev` | `Staff@123` |
| Staff | `staff2@clinicflow.dev` | `Staff@123` |

The seed also creates 5 patients and 10 appointments with mixed statuses
(pending, confirmed, cancelled).

## 5. Run the backend

From `backend/`:

```bash
npm run dev     # nodemon, reloads on change
# or
npm start       # plain Node
```

The API listens on `http://localhost:4000`. Health check:

```bash
curl http://localhost:4000/api/health
```

## 6. Run the frontend

From `frontend/` (in a second terminal):

```bash
cp .env.example .env
npm run dev
```

On Windows PowerShell:

```powershell
Copy-Item .env.example .env
npm run dev
```

Open `http://localhost:5173`. The Vite dev server proxies `/api` to
`http://localhost:4000`, so the browser stays same-origin.

## Available scripts

### Backend (`backend/`)

| Command | Description |
| --- | --- |
| `npm start` | Start the API |
| `npm run dev` | Start the API with nodemon |
| `npm run db:migrate` | Apply the idempotent schema migration |
| `npm run db:seed` | Truncate and load demo data |
| `npm run db:setup` | `db:migrate` + `db:seed` |
| `npm run db:reset` | Drop application objects, migrate and seed |
| `npm test` | Jest + Supertest API test suite |
| `npm run test:smoke` | Live HTTP smoke test (API must be running) |

### Frontend (`frontend/`)

| Command | Description |
| --- | --- |
| `npm run dev` | Vite development server on port 5173 |
| `npm run build` | Production build into `dist/` |
| `npm run preview` | Preview the production build on port 5173 |
| `npm run test:e2e` | Browser E2E smoke test (servers must be running) |

## API endpoints

All patient, appointment and dashboard endpoints require
`Authorization: Bearer <token>`.

| Method | Path | Notes |
| --- | --- | --- |
| `POST` | `/api/auth/login` | `{ email, password }` -> `{ token, user }` |
| `GET` | `/api/auth/me` | Current authenticated user |
| `POST` | `/api/patients` | Create patient |
| `GET` | `/api/patients?search=&page=&limit=` | Paginated search by name/CIN |
| `GET` | `/api/patients/:id` | Patient details + appointment history |
| `PUT` | `/api/patients/:id` | Update patient |
| `DELETE` | `/api/patients/:id` | Admin only; cascades appointments |
| `POST` | `/api/appointments` | Create appointment |
| `GET` | `/api/appointments?date=&status=&patientId=&page=&limit=` | Paginated filters |
| `PATCH` | `/api/appointments/:id/status` | `{ status }` |
| `GET` | `/api/dashboard/stats` | Dashboard counters |
| `GET` | `/api/dashboard/upcoming?limit=` | Upcoming appointments |
| `GET` | `/api/health` | Health check |

### Example requests

```bash
# Login
curl -X POST http://localhost:4000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@clinicflow.dev","password":"Admin@123"}'

# List patients (replace TOKEN)
curl "http://localhost:4000/api/patients?search=Youssef&page=1&limit=10" \
  -H "Authorization: Bearer TOKEN"

# Create a patient
curl -X POST http://localhost:4000/api/patients \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"fullName":"New Patient","cin":"ZZ123456","phone":"+212600000000","birthDate":"1990-01-01"}'

# Confirm an appointment
curl -X PATCH http://localhost:4000/api/appointments/APPOINTMENT_ID/status \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"status":"confirmed"}'
```

## Error responses

Errors use a consistent JSON envelope:

```json
{
  "success": false,
  "error": {
    "message": "Validation failed",
    "code": "VALIDATION_ERROR",
    "details": [{ "field": "cin", "message": "CIN is required", "code": "too_small" }]
  }
}
```

Status codes: `400`/`422` validation, `401` authentication, `403` permissions,
`404` not found, `409` conflict (duplicate CIN or 30-minute rule), `500`
unexpected server error.

## Testing

### Backend

The test suite resets the database, applies the migration, seeds data and
exercises the API with Supertest:

```bash
cd backend
npm test
```

Coverage includes authentication, invalid credentials, JWT checks, patient CRUD,
CIN uniqueness, search, pagination, admin-only deletion, cascade deletion,
appointment creation, filters, status changes, the 30-minute rule, concurrent
confirmation requests and dashboard statistics.

### Live API smoke test

With the API running and the database seeded:

```bash
cd backend
npm run test:smoke
```

The script creates its own patient and appointments, exercises the live HTTP
endpoints (authentication, patients, filters, the 30-minute rule, concurrent
confirmations, dashboard statistics, admin deletion and cascade) and deletes the
patient at the end. Override the target with `API_SMOKE_BASE_URL` or the
credentials with `API_SMOKE_ADMIN_EMAIL`, `API_SMOKE_ADMIN_PASSWORD`,
`API_SMOKE_STAFF_EMAIL` and `API_SMOKE_STAFF_PASSWORD`.

### Browser E2E smoke test

With the backend, the Vite dev server and the seeded database running:

```bash
cd frontend
npm run test:e2e
```

The test drives Chrome or Edge through login, the dashboard, patient search and
details, appointment filters and status updates, logout, staff permissions and
the mobile sidebar. It creates its own patient through the API and deletes it
afterwards, so it can be run repeatedly. `playwright-core` is installed as a dev
dependency and uses the system browser; set `E2E_CHANNEL` or
`E2E_EXECUTABLE_PATH` if Chrome/Edge is not detected automatically. Use
`E2E_HEADED=1` to watch the run, and `E2E_BASE_URL` / `E2E_API_URL` to override
the default local URLs.

The login endpoint allows 20 attempts per 15 minutes. If you run the smoke tests
repeatedly, wait for the window to reset or restart the backend before retrying.

### Frontend build

```bash
cd frontend
npm run build
```

## 30-minute conflict rule notes

The rule is enforced in the service layer inside a transaction while holding a
`SELECT ... FOR UPDATE` lock on the patient row, and again by a PostgreSQL GiST
exclusion constraint as a safety net. This means concurrent requests cannot both
confirm conflicting appointments. See [`docs/DATABASE.md`](docs/DATABASE.md) for
the detailed design.

## Security notes

- Passwords are hashed with bcrypt.
- JWTs are signed with `JWT_SECRET` and expire.
- SQL queries are parameterized.
- Helmet sets security headers.
- Login attempts are rate limited.
- Role checks are enforced on the backend (the frontend only hides actions).

## Local-only scope

This repository is configured for local development. No deployment or hosting
configuration is included or required.
