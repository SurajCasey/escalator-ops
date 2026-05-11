-- ============================================================
-- Migration v8: Jobs → Parent Jobs + Visits
-- ============================================================
-- Run this once in Supabase SQL Editor.
-- Safe to run multiple times (uses IF NOT EXISTS / IF EXISTS).
--
-- What this does:
--   1. Creates recurring_templates table
--   2. Creates visits table
--   3. Creates visit_assignments table
--   4. Extends jobs table with new columns
--   5. Migrates existing data: each current job gets one visit
--   6. Migrates job_assignments → visit_assignments
--   7. Migrates time_entries to reference visit_id
--   8. Adds visit_id to inspection_instances (pre-starts)
--   9. Sets up RLS policies for new tables
-- ============================================================


-- ── 1. RECURRING TEMPLATES ────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS recurring_templates (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id         UUID REFERENCES clients(id) ON DELETE SET NULL,
  client_name       TEXT NOT NULL,
  site_name         TEXT,
  title             TEXT NOT NULL,          -- e.g. "Monthly escalator clean – Westfield"
  frequency_days    INTEGER NOT NULL,       -- 7=weekly, 14=fortnightly, 30=monthly, etc.
  flat_rate         NUMERIC(10,2),          -- rate per generated job
  notes             TEXT,
  lead_days         INTEGER NOT NULL DEFAULT 90, -- how far ahead to pre-generate jobs
  status            TEXT NOT NULL DEFAULT 'ACTIVE'
                    CHECK (status IN ('ACTIVE', 'PAUSED', 'CANCELLED')),
  last_generated_at TIMESTAMPTZ,           -- timestamp of the most recent generated job
  next_due_date     DATE,                  -- when the next job should be generated
  created_by        UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── 2. EXTEND JOBS TABLE ──────────────────────────────────────────────────────
-- Add new columns to existing jobs table.
-- Old columns (assigned_to, assigned_to_name, scheduled_at, frequency_days,
-- parent_job_id, booking_id) are kept for backward-compat during migration,
-- then deprecated after all UI is updated.

ALTER TABLE jobs
  ADD COLUMN IF NOT EXISTS recurring_template_id UUID REFERENCES recurring_templates(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS is_generated           BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS scheduled_start        TIMESTAMPTZ,  -- derived from first visit; cached for querying
  ADD COLUMN IF NOT EXISTS scheduled_end          TIMESTAMPTZ,  -- derived from last visit; cached for querying
  ADD COLUMN IF NOT EXISTS visit_count            INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS completed_visit_count  INTEGER NOT NULL DEFAULT 0;

-- Update jobs_status_check to include PENDING and OVERDUE if not already present
-- Drop old constraint and re-add with full set
ALTER TABLE jobs DROP CONSTRAINT IF EXISTS jobs_status_check;
ALTER TABLE jobs ADD CONSTRAINT jobs_status_check
  CHECK (status IN ('DRAFT', 'SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'OVERDUE', 'CANCELLED', 'PENDING'));


-- ── 3. VISITS TABLE ───────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS visits (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id         UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  scheduled_at   TIMESTAMPTZ NOT NULL,
  status         TEXT NOT NULL DEFAULT 'SCHEDULED'
                 CHECK (status IN ('SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'OVERDUE')),
  notes          TEXT,
  completed_at   TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS visits_job_id_idx      ON visits(job_id);
CREATE INDEX IF NOT EXISTS visits_scheduled_at_idx ON visits(scheduled_at);
CREATE INDEX IF NOT EXISTS visits_status_idx       ON visits(status);


-- ── 4. VISIT_ASSIGNMENTS TABLE ────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS visit_assignments (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  visit_id    UUID NOT NULL REFERENCES visits(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (visit_id, employee_id)
);

CREATE INDEX IF NOT EXISTS visit_assignments_visit_id_idx    ON visit_assignments(visit_id);
CREATE INDEX IF NOT EXISTS visit_assignments_employee_id_idx ON visit_assignments(employee_id);


-- ── 5. EXTEND TIME_ENTRIES TO REFERENCE VISITS ───────────────────────────────
-- Add visit_id column. Nullable initially so existing rows aren't broken.
-- After data migration (step 7) it will be populated for all rows.

ALTER TABLE time_entries
  ADD COLUMN IF NOT EXISTS visit_id UUID REFERENCES visits(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS time_entries_visit_id_idx ON time_entries(visit_id);


-- ── 6. EXTEND INSPECTION_INSTANCES TO REFERENCE VISITS ───────────────────────
-- Pre-starts are per-visit. Add visit_id column.

ALTER TABLE inspection_instances
  ADD COLUMN IF NOT EXISTS visit_id UUID REFERENCES visits(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS inspection_instances_visit_id_idx ON inspection_instances(visit_id);


-- ── 7. DATA MIGRATION: CREATE ONE VISIT PER EXISTING JOB ─────────────────────
--
-- For every existing job that doesn't yet have a visit:
--   - Create a visit using the job's scheduled_at, status, and completed_at
--   - Map job_assignments for that job → visit_assignments on the new visit
--   - Point time_entries for that job → the new visit
--   - Update jobs.scheduled_start and scheduled_end
--   - Update jobs.visit_count and completed_visit_count
--
-- This is wrapped in a DO block so it can use variables and loops safely.

DO $$
DECLARE
  r              RECORD;
  new_visit_id   UUID;
  visit_status   TEXT;
BEGIN

  -- Iterate over every job that has no visits yet
  FOR r IN
    SELECT j.*
    FROM   jobs j
    LEFT   JOIN visits v ON v.job_id = j.id
    WHERE  v.id IS NULL
  LOOP

    -- Map legacy job status to visit status
    visit_status := CASE r.status
      WHEN 'COMPLETED'   THEN 'COMPLETED'
      WHEN 'IN_PROGRESS' THEN 'IN_PROGRESS'
      WHEN 'CANCELLED'   THEN 'CANCELLED'
      WHEN 'OVERDUE'     THEN 'OVERDUE'
      ELSE 'SCHEDULED'
    END;

    -- Create the visit
    INSERT INTO visits (job_id, scheduled_at, status, notes, completed_at, created_at, updated_at)
    VALUES (
      r.id,
      COALESCE(r.scheduled_at, now()),
      visit_status,
      r.notes,
      r.completed_at,
      r.created_at,
      r.created_at
    )
    RETURNING id INTO new_visit_id;

    -- Migrate job_assignments → visit_assignments
    INSERT INTO visit_assignments (visit_id, employee_id)
    SELECT new_visit_id, ja.employee_id
    FROM   job_assignments ja
    WHERE  ja.job_id = r.id
    ON CONFLICT (visit_id, employee_id) DO NOTHING;

    -- Point time_entries to the new visit
    UPDATE time_entries
    SET    visit_id = new_visit_id
    WHERE  job_id   = r.id
    AND    visit_id IS NULL;

    -- Point inspection_instances (pre-starts) to the new visit
    UPDATE inspection_instances
    SET    visit_id = new_visit_id
    WHERE  job_id   = r.id
    AND    visit_id IS NULL;

    -- Update parent job cache columns
    UPDATE jobs
    SET
      scheduled_start       = r.scheduled_at,
      scheduled_end         = r.scheduled_at,
      visit_count           = 1,
      completed_visit_count = CASE WHEN r.status = 'COMPLETED' THEN 1 ELSE 0 END
    WHERE id = r.id;

  END LOOP;

END $$;


-- ── 8. UPDATED_AT TRIGGERS ────────────────────────────────────────────────────
-- Automatically keep updated_at current on visits and recurring_templates.

CREATE OR REPLACE FUNCTION touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS visits_updated_at ON visits;
CREATE TRIGGER visits_updated_at
  BEFORE UPDATE ON visits
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

DROP TRIGGER IF EXISTS recurring_templates_updated_at ON recurring_templates;
CREATE TRIGGER recurring_templates_updated_at
  BEFORE UPDATE ON recurring_templates
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();


-- ── 9. FUNCTION: auto-update parent job cache when visits change ───────────────
-- Called whenever a visit is inserted, updated, or deleted.
-- Updates: scheduled_start, scheduled_end, visit_count, completed_visit_count, status

CREATE OR REPLACE FUNCTION sync_job_from_visits()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  target_job_id  UUID;
  v_count        INTEGER;
  v_completed    INTEGER;
  v_in_progress  INTEGER;
  v_earliest     TIMESTAMPTZ;
  v_latest       TIMESTAMPTZ;
  new_status     TEXT;
BEGIN
  -- Determine which job was affected
  target_job_id := COALESCE(NEW.job_id, OLD.job_id);

  -- Aggregate visits (excluding cancelled)
  SELECT
    COUNT(*)                                          FILTER (WHERE status != 'CANCELLED'),
    COUNT(*)                                          FILTER (WHERE status = 'COMPLETED'),
    COUNT(*)                                          FILTER (WHERE status = 'IN_PROGRESS'),
    MIN(scheduled_at)                                 FILTER (WHERE status != 'CANCELLED'),
    MAX(scheduled_at)                                 FILTER (WHERE status != 'CANCELLED')
  INTO v_count, v_completed, v_in_progress, v_earliest, v_latest
  FROM visits
  WHERE job_id = target_job_id;

  -- Derive parent status (never auto-set COMPLETED — admin must confirm)
  SELECT status INTO new_status FROM jobs WHERE id = target_job_id;

  IF new_status NOT IN ('COMPLETED', 'CANCELLED') THEN
    IF v_in_progress > 0 THEN
      new_status := 'IN_PROGRESS';
    ELSIF v_count > 0 THEN
      new_status := 'SCHEDULED';
    ELSE
      new_status := 'DRAFT';
    END IF;
  END IF;

  -- Write back to jobs
  UPDATE jobs SET
    scheduled_start       = v_earliest,
    scheduled_end         = v_latest,
    visit_count           = COALESCE(v_count, 0),
    completed_visit_count = COALESCE(v_completed, 0),
    status                = new_status
  WHERE id = target_job_id;

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS visits_sync_job ON visits;
CREATE TRIGGER visits_sync_job
  AFTER INSERT OR UPDATE OR DELETE ON visits
  FOR EACH ROW EXECUTE FUNCTION sync_job_from_visits();


-- ── 10. FUNCTION: generate future jobs from recurring templates ───────────────
-- Call this from a Supabase Edge Function cron, or on app load for the admin.
-- Generates parent jobs for all ACTIVE templates up to lead_days ahead.

CREATE OR REPLACE FUNCTION generate_recurring_jobs()
RETURNS INTEGER LANGUAGE plpgsql AS $$
DECLARE
  tmpl          RECORD;
  next_date     DATE;
  horizon_date  DATE;
  new_job_id    UUID;
  jobs_created  INTEGER := 0;
BEGIN

  FOR tmpl IN
    SELECT * FROM recurring_templates WHERE status = 'ACTIVE'
  LOOP

    horizon_date := CURRENT_DATE + tmpl.lead_days;

    -- Find the next date that needs a job generated
    -- Start from next_due_date, or today if not set
    next_date := COALESCE(tmpl.next_due_date, CURRENT_DATE);

    -- Keep generating until we've filled the horizon window
    WHILE next_date <= horizon_date LOOP

      -- Only create a job if one doesn't already exist for this template + date window
      -- (check within ±1 day to avoid duplicates from reruns)
      IF NOT EXISTS (
        SELECT 1 FROM jobs
        WHERE  recurring_template_id = tmpl.id
        AND    scheduled_start::DATE BETWEEN next_date - 1 AND next_date + 1
      ) THEN

        -- Create the parent job
        INSERT INTO jobs (
          title,
          client_id,
          client_name,
          site_name,
          status,
          flat_rate,
          notes,
          job_type,
          frequency_days,
          recurring_template_id,
          is_generated,
          scheduled_at,         -- legacy column; keep for compat
          assigned_to,          -- legacy; null for generated jobs
          assigned_to_name
        ) VALUES (
          tmpl.title,
          tmpl.client_id,
          tmpl.client_name,
          tmpl.site_name,
          'SCHEDULED',
          tmpl.flat_rate,
          tmpl.notes,
          'CONTRACT',
          tmpl.frequency_days,
          tmpl.id,
          true,
          (next_date::TIMESTAMPTZ),
          NULL,
          ''
        )
        RETURNING id INTO new_job_id;

        -- Create the default first visit for this generated job
        INSERT INTO visits (job_id, scheduled_at, status)
        VALUES (new_job_id, next_date::TIMESTAMPTZ, 'SCHEDULED');

        jobs_created := jobs_created + 1;

      END IF;

      -- Advance by frequency
      next_date := next_date + tmpl.frequency_days;

    END LOOP;

    -- Update the template's next_due_date to the first date beyond horizon
    UPDATE recurring_templates
    SET
      last_generated_at = now(),
      next_due_date     = next_date
    WHERE id = tmpl.id;

  END LOOP;

  RETURN jobs_created;

END;
$$;


-- ── 11. ROW LEVEL SECURITY ────────────────────────────────────────────────────

ALTER TABLE recurring_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE visits               ENABLE ROW LEVEL SECURITY;
ALTER TABLE visit_assignments    ENABLE ROW LEVEL SECURITY;

-- recurring_templates: admins can do everything; employees can read
DROP POLICY IF EXISTS "Admins manage recurring_templates"  ON recurring_templates;
DROP POLICY IF EXISTS "Employees read recurring_templates" ON recurring_templates;

CREATE POLICY "Admins manage recurring_templates" ON recurring_templates
  FOR ALL
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'ADMIN' AND status = 'ACTIVE')
  );

CREATE POLICY "Employees read recurring_templates" ON recurring_templates
  FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND status = 'ACTIVE')
  );

-- visits: admins can do everything; employees see only visits they're assigned to
DROP POLICY IF EXISTS "Admins manage visits"   ON visits;
DROP POLICY IF EXISTS "Employees read visits"  ON visits;

CREATE POLICY "Admins manage visits" ON visits
  FOR ALL
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'ADMIN' AND status = 'ACTIVE')
  );

CREATE POLICY "Employees read assigned visits" ON visits
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM visit_assignments va
      WHERE  va.visit_id    = visits.id
      AND    va.employee_id = auth.uid()
    )
    OR
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'ADMIN' AND status = 'ACTIVE')
  );

-- visit_assignments: admins manage; employees see their own
DROP POLICY IF EXISTS "Admins manage visit_assignments"  ON visit_assignments;
DROP POLICY IF EXISTS "Employees read visit_assignments" ON visit_assignments;

CREATE POLICY "Admins manage visit_assignments" ON visit_assignments
  FOR ALL
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'ADMIN' AND status = 'ACTIVE')
  );

CREATE POLICY "Employees read own visit_assignments" ON visit_assignments
  FOR SELECT
  USING (employee_id = auth.uid());


-- ── 12. HELPFUL VIEWS ─────────────────────────────────────────────────────────

-- jobs_with_visit_summary: denormalised view for the schedule page
CREATE OR REPLACE VIEW jobs_with_visit_summary AS
SELECT
  j.*,
  COALESCE(v_agg.total_visits, 0)     AS total_visits,
  COALESCE(v_agg.completed_visits, 0) AS completed_visits,
  v_agg.next_visit_at,
  v_agg.last_visit_at
FROM jobs j
LEFT JOIN (
  SELECT
    job_id,
    COUNT(*)                                    FILTER (WHERE status != 'CANCELLED') AS total_visits,
    COUNT(*)                                    FILTER (WHERE status = 'COMPLETED')  AS completed_visits,
    MIN(scheduled_at)                           FILTER (WHERE status = 'SCHEDULED' AND scheduled_at > now()) AS next_visit_at,
    MAX(scheduled_at)                           FILTER (WHERE status = 'COMPLETED') AS last_visit_at
  FROM visits
  GROUP BY job_id
) v_agg ON v_agg.job_id = j.id;

-- visits_with_job: useful for the clock-in page (employees pick a visit)
CREATE OR REPLACE VIEW visits_with_job AS
SELECT
  v.*,
  j.title          AS job_title,
  j.client_name,
  j.site_name,
  j.flat_rate,
  j.notes          AS job_notes
FROM visits v
JOIN jobs j ON j.id = v.job_id;


-- ── DONE ──────────────────────────────────────────────────────────────────────
-- To trigger recurring job generation, call:
--   SELECT generate_recurring_jobs();
-- from Supabase SQL Editor or a scheduled Edge Function.
-- ─────────────────────────────────────────────────────────────────────────────
