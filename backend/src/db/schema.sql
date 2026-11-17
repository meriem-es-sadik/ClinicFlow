-- ===========================================================================
-- ClinicFlow - PostgreSQL schema / idempotent migration
-- ---------------------------------------------------------------------------
-- This file is applied by `npm run db:migrate`. It is intentionally
-- NON-DESTRUCTIVE: it uses IF NOT EXISTS / CREATE OR REPLACE everywhere and
-- never drops tables. Existing rows are preserved when you re-run it.
-- For a clean local reset use `npm run db:reset` (explicitly destructive).
--
-- Design notes
--   * UUID primary keys (gen_random_uuid from pgcrypto) avoid exposing
--     sequential ids and make distributed generation possible.
--   * patients.cin is UNIQUE: the CIN is the national identity number and must
--     identify a single patient.
--   * Relations:
--       users      1 --- N appointments   (appointments.created_by)
--       patients   1 --- N appointments   (appointments.patient_id)
--     Both are 1-N because one user can create many appointments and one
--     patient can have many appointments. There is no N-N relation in the
--     mandatory scope.
--   * Deletion rules:
--       patients  -> appointments : ON DELETE CASCADE
--         An appointment has no meaning without its patient, so removing a
--         patient removes their appointment history.
--       users     -> appointments : ON DELETE RESTRICT
--         A user who created appointments is part of the audit trail and must
--         not be deleted while their records exist.
--   * Indexes are added on the columns used for filtering / searching
--     (patients.full_name, patients.cin, appointments.appointment_date,
--     appointments.status, foreign keys).
--   * The mandatory business rule ("a patient cannot have two confirmed
--     appointments inside a 30 minute window") is enforced at the database
--     level with a GiST exclusion constraint as a safety net, and also checked
--     in the application inside a transaction (see appointment.service.js).
-- ===========================================================================

-- Required extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";   -- gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS "btree_gist"; -- GiST exclusion constraint on UUID + range

-- ---------------------------------------------------------------------------
-- Enumerations (idempotent creation)
-- ---------------------------------------------------------------------------
DO $$
BEGIN
    CREATE TYPE user_role AS ENUM ('admin', 'staff');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
    CREATE TYPE appointment_status AS ENUM ('pending', 'confirmed', 'cancelled');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- ---------------------------------------------------------------------------
-- users
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    full_name     VARCHAR(120)  NOT NULL,
    email         VARCHAR(160)  NOT NULL,
    password_hash VARCHAR(255)  NOT NULL,
    role          user_role     NOT NULL DEFAULT 'staff',
    created_at    TIMESTAMPTZ   NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ   NOT NULL DEFAULT now(),
    CONSTRAINT users_email_unique UNIQUE (email),
    CONSTRAINT users_email_format CHECK (position('@' in email) > 1)
);

-- ---------------------------------------------------------------------------
-- patients
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS patients (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    full_name  VARCHAR(160) NOT NULL,
    cin        VARCHAR(20)  NOT NULL,
    phone      VARCHAR(30)  NOT NULL,
    birth_date DATE         NOT NULL,
    address    VARCHAR(255),
    created_at TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ  NOT NULL DEFAULT now(),
    CONSTRAINT patients_cin_unique UNIQUE (cin)
);

-- Indexes supporting search / sorting on the patient list
CREATE INDEX IF NOT EXISTS idx_patients_full_name ON patients (lower(full_name));
CREATE INDEX IF NOT EXISTS idx_patients_cin       ON patients (cin);
CREATE INDEX IF NOT EXISTS idx_patients_created_at ON patients (created_at DESC);

-- ---------------------------------------------------------------------------
-- appointments
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS appointments (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id       UUID NOT NULL REFERENCES patients (id) ON DELETE CASCADE,
    appointment_date TIMESTAMPTZ NOT NULL,
    status           appointment_status NOT NULL DEFAULT 'pending',
    reason           VARCHAR(255) NOT NULL,
    notes            TEXT,
    created_by       UUID NOT NULL REFERENCES users (id) ON DELETE RESTRICT,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),

    -- Range of +/-15 minutes around a *confirmed* appointment, maintained by a
    -- trigger. Two ranges overlap exactly when the appointments are closer than
    -- 30 minutes. It is stored in a column because `timestamptz - interval` is
    -- STABLE (timezone dependent) and therefore cannot be indexed directly.
    confirmed_slot   TSTZRANGE,

    -- Two confirmed appointments for the same patient must be at least 30
    -- minutes apart. This is the database-level safety net for the rule.
    CONSTRAINT appointments_no_confirmed_overlap
        EXCLUDE USING gist (
            patient_id WITH =,
            confirmed_slot WITH &&
        )
);

CREATE INDEX IF NOT EXISTS idx_appointments_patient_id       ON appointments (patient_id);
CREATE INDEX IF NOT EXISTS idx_appointments_created_by       ON appointments (created_by);
CREATE INDEX IF NOT EXISTS idx_appointments_appointment_date ON appointments (appointment_date);
CREATE INDEX IF NOT EXISTS idx_appointments_status           ON appointments (status);
-- Composite index for the common "filter by day + status" query
CREATE INDEX IF NOT EXISTS idx_appointments_date_status      ON appointments (appointment_date, status);

-- Safety net for databases created by an older version of this schema.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'appointments_no_confirmed_overlap'
    ) THEN
        ALTER TABLE appointments
            ADD CONSTRAINT appointments_no_confirmed_overlap
            EXCLUDE USING gist (
                patient_id WITH =,
                confirmed_slot WITH &&
            );
    END IF;
END $$;

-- ---------------------------------------------------------------------------
-- updated_at maintenance
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_users_updated_at ON users;
CREATE TRIGGER trg_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_patients_updated_at ON patients;
CREATE TRIGGER trg_patients_updated_at
    BEFORE UPDATE ON patients
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_appointments_updated_at ON appointments;
CREATE TRIGGER trg_appointments_updated_at
    BEFORE UPDATE ON appointments
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Keep appointments.confirmed_slot in sync so the exclusion constraint can be
-- enforced by PostgreSQL itself.
CREATE OR REPLACE FUNCTION set_appointment_confirmed_slot()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status = 'confirmed' THEN
        NEW.confirmed_slot := tstzrange(
            NEW.appointment_date - interval '15 minutes',
            NEW.appointment_date + interval '15 minutes'
        );
    ELSE
        NEW.confirmed_slot := NULL;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_appointments_confirmed_slot ON appointments;
CREATE TRIGGER trg_appointments_confirmed_slot
    BEFORE INSERT OR UPDATE OF appointment_date, status ON appointments
    FOR EACH ROW EXECUTE FUNCTION set_appointment_confirmed_slot();
