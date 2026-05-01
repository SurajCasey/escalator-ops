-- ============================================================
--  supabase_migration_v7.sql
--  SafetyCulture-style inspection template system
--  Run this in your Supabase SQL editor
-- ============================================================

-- ─── 1. inspection_templates ─────────────────────────────────
-- Stores versioned form definitions. Once a version is published
-- it is never mutated — create a new version instead.
CREATE TABLE IF NOT EXISTS inspection_templates (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name        TEXT NOT NULL,
  type        TEXT NOT NULL CHECK (type IN ('PRESTART','SWMS','GENERAL')),
  version     INTEGER NOT NULL DEFAULT 1,
  is_active   BOOLEAN NOT NULL DEFAULT true,
  schema      JSONB NOT NULL,          -- TemplateSchema JSON
  created_by  UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (type, version)               -- no duplicate versions per type
);

ALTER TABLE inspection_templates ENABLE ROW LEVEL SECURITY;

-- All authenticated users can read templates
CREATE POLICY "templates_read_all" ON inspection_templates
  FOR SELECT TO authenticated USING (true);

-- Only admins can create/edit templates
CREATE POLICY "templates_admin_write" ON inspection_templates
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- ─── 2. inspection_instances ─────────────────────────────────
-- One row per filled-in inspection. template_id + template_version
-- are frozen at creation so old completions always reference the
-- exact schema they were filled with.
CREATE TABLE IF NOT EXISTS inspection_instances (
  id                UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  template_id       UUID NOT NULL REFERENCES inspection_templates(id),
  template_version  INTEGER NOT NULL,
  job_id            UUID REFERENCES jobs(id) ON DELETE SET NULL,
  user_id           UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  status            TEXT NOT NULL DEFAULT 'DRAFT'
                      CHECK (status IN ('DRAFT','SUBMITTED','APPROVED')),
  answers           JSONB NOT NULL DEFAULT '{}',
  -- metadata: title, clientName, siteName, preparedBy — not part of answers
  metadata          JSONB NOT NULL DEFAULT '{}',
  pdf_path          TEXT,
  submitted_at      TIMESTAMPTZ,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE inspection_instances ENABLE ROW LEVEL SECURITY;

-- Employees see and manage their own instances
CREATE POLICY "instances_own" ON inspection_instances
  FOR ALL TO authenticated
  USING     (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Admins see and manage everything
CREATE POLICY "instances_admin" ON inspection_instances
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_inspection_instances_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;

CREATE TRIGGER trg_instances_updated_at
  BEFORE UPDATE ON inspection_instances
  FOR EACH ROW EXECUTE FUNCTION update_inspection_instances_updated_at();

-- ─── 3. inspection_attachments ───────────────────────────────
-- Photos, signatures, PDFs linked to a specific question in an instance.
CREATE TABLE IF NOT EXISTS inspection_attachments (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  instance_id   UUID NOT NULL REFERENCES inspection_instances(id) ON DELETE CASCADE,
  question_id   TEXT NOT NULL,
  type          TEXT NOT NULL CHECK (type IN ('PHOTO','SIGNATURE','PDF','EVIDENCE')),
  storage_path  TEXT NOT NULL,
  public_url    TEXT,
  filename      TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE inspection_attachments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "attachments_own" ON inspection_attachments
  FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM inspection_instances i
            WHERE i.id = instance_id AND i.user_id = auth.uid())
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM inspection_instances i
            WHERE i.id = instance_id AND i.user_id = auth.uid())
  );

CREATE POLICY "attachments_admin" ON inspection_attachments
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- ─── 4. Seed: Pre-start v1 template ──────────────────────────
INSERT INTO inspection_templates (name, type, version, is_active, schema) VALUES (
'Pre-start OH&S and Site Inspection', 'PRESTART', 1, true,
'{
  "sections": [
    {
      "id": "prestart_audit",
      "title": "Prestart Audit",
      "questions": [
        { "id": "work_type",         "type": "text",    "label": "What type(s) of works are you performing?",                                            "required": true,  "defaultValue": "Escalator Cleaning" },
        { "id": "area",              "type": "text",    "label": "What area will you be working?",                                                      "required": true  },
        { "id": "equipment_type",    "type": "text",    "label": "What type of equipment are you working on?",                                          "required": true,  "defaultValue": "Escalator" },
        { "id": "visual_inspection", "type": "yes_no",  "label": "Have you completed a visual safety inspection prior to any works being carried out?", "required": true  }
      ]
    },
    {
      "id": "safety_audit",
      "title": "Safety Audit",
      "questions": [
        { "id": "ppe_appropriate",    "type": "yes_no",   "label": "Do you have the appropriate PPE to undertake the works?",                                                       "required": true  },
        { "id": "site_induction",     "type": "yes_no",   "label": "Have you received a site induction?",                                                                          "required": true  },
        { "id": "machinery_order",    "type": "yes_no",   "label": "Have you checked if our machinery is in good working order?",                                                   "required": true  },
        { "id": "pre_mount_checks",   "type": "yes_no",   "label": "Have you completed your checks before mounting the machines on the escalator/travelator?",                     "required": true  },
        { "id": "reverse_check",      "type": "yes_no",   "label": "Have you checked if the escalator/travelator drives in reverse prior to starting works?",                      "required": true  },
        { "id": "concerns_damage",    "type": "yes_no",   "label": "Is there any concerns or damage on the escalator/travelator?",                                                 "required": true,  "flagIf": true },
        { "id": "concerns_notes",     "type": "textarea", "label": "Describe the concern or damage",                                                                               "required": false, "conditionalShow": { "questionId": "concerns_damage", "value": true } },
        { "id": "barricades",         "type": "yes_no",   "label": "Have you used the maintenance barricades to ensure the escalator/travelator is blocked off?",                  "required": true  },
        { "id": "any_concerns",       "type": "yes_no",   "label": "Do you have any other concerns or comments?",                                                                  "required": false, "flagIf": true },
        { "id": "concern_comments",   "type": "textarea", "label": "Describe your concerns",                                                                                       "required": false, "conditionalShow": { "questionId": "any_concerns", "value": true } }
      ]
    },
    {
      "id": "sign_off",
      "title": "Sign Off",
      "questions": [
        { "id": "site_location",   "type": "text", "label": "Site Location",       "required": true  },
        { "id": "worker_names",    "type": "text", "label": "Name of workers",      "required": true  },
        { "id": "supervisor_name", "type": "text", "label": "Supervisor name",      "required": true  },
        { "id": "document_date",   "type": "date", "label": "Date",                 "required": true  },
        { "id": "start_time",      "type": "time", "label": "Start time (AEST)",    "required": false }
      ]
    }
  ]
}'::jsonb
) ON CONFLICT (type, version) DO NOTHING;

-- ─── 5. Seed: SWMS v1 template ───────────────────────────────
INSERT INTO inspection_templates (name, type, version, is_active, schema) VALUES (
'JSEA & Safe Work Method Statement (SWMS)', 'SWMS', 1, true,
'{
  "sections": [
    {
      "id": "part1",
      "title": "Part 1 — Project and Task Identification",
      "questions": [
        { "id": "client_name",       "type": "text",  "label": "Client",                       "required": true  },
        { "id": "job_site_address",  "type": "text",  "label": "Job Site / Address",            "required": true  },
        { "id": "contact_name",      "type": "text",  "label": "Contact Name",                  "required": false },
        { "id": "contact_title",     "type": "text",  "label": "Contact Job Title",              "required": false },
        { "id": "contact_phone",     "type": "text",  "label": "Phone",                          "required": false },
        { "id": "contact_mobile",    "type": "text",  "label": "Mobile",                         "required": false },
        { "id": "contact_email",     "type": "text",  "label": "Email",                          "required": false },
        { "id": "initiated_by",      "type": "text",  "label": "SWMS Initiated By",              "required": true  },
        { "id": "document_date",     "type": "date",  "label": "Date",                           "required": true  },
        { "id": "swms_number",       "type": "text",  "label": "SWMS No.",                       "required": false, "defaultValue": "1" },
        { "id": "swms_rev",          "type": "text",  "label": "Rev",                            "required": false, "defaultValue": "1" },
        { "id": "work_locations",    "type": "text",  "label": "Work Locations / Areas",         "required": true  },
        { "id": "supervisor_review", "type": "text",  "label": "Supervisor Review (name)",       "required": false },
        { "id": "management_review", "type": "text",  "label": "Management Review (name)",       "required": false }
      ]
    },
    {
      "id": "part2",
      "title": "Part 2 — Worker Sign-Off",
      "description": "Your signature below indicates you have been consulted in development of the SWMS and accept and will implement the requirements and control measures.",
      "questions": [
        { "id": "workers", "type": "worker_table", "label": "Workers", "required": false }
      ]
    }
  ]
}'::jsonb
) ON CONFLICT (type, version) DO NOTHING;

-- ─── Storage bucket (create via Supabase dashboard) ──────────
-- Name: inspection-files
-- Public: NO (private bucket, use signed URLs)
-- Run in dashboard Storage → New bucket → inspection-files
