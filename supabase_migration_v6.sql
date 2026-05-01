-- ============================================================
--  supabase_migration_v6.sql
--  SWMS Document Storage: bucket + table
--  Run this in your Supabase SQL editor
-- ============================================================

-- ─── Storage bucket ──────────────────────────────────────────
-- Create in Supabase Dashboard: Storage → New bucket
-- Name: swms-documents, Public: YES (so getPublicUrl works)
--
-- Alternatively, use the Supabase Management API:
--   POST /storage/v1/bucket
--   { "id": "swms-documents", "name": "swms-documents", "public": true }
--
-- The RLS policies below control who can UPLOAD — the bucket
-- can be public-readable so that generated links work without auth.

-- ─── SWMS Documents table ────────────────────────────────────
CREATE TABLE IF NOT EXISTS swms_documents (
  id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  job_id       UUID REFERENCES jobs(id) ON DELETE SET NULL,
  storage_path TEXT NOT NULL,       -- e.g. "swms-documents/swms_abc_123.pdf"
  public_url   TEXT NOT NULL,       -- Supabase public URL for direct download
  created_by   UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE swms_documents ENABLE ROW LEVEL SECURITY;

-- Authenticated employees can insert their own documents
CREATE POLICY "swms_documents_insert_own" ON swms_documents
  FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid());

-- All authenticated users can read all SWMS documents
CREATE POLICY "swms_documents_read_all" ON swms_documents
  FOR SELECT TO authenticated
  USING (true);

-- Admins can do everything
CREATE POLICY "swms_documents_admin_all" ON swms_documents
  FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- ─── Storage RLS (run via Supabase dashboard or API) ─────────
-- In the Supabase dashboard, go to Storage → swms-documents → Policies
-- and add:
--
-- Policy: "Allow authenticated uploads"
--   Allowed operation: INSERT
--   Target roles: authenticated
--   Policy definition: true
--
-- Policy: "Allow authenticated reads"
--   Allowed operation: SELECT
--   Target roles: authenticated
--   Policy definition: true
--
-- Or as SQL (these run in the storage schema):
/*
CREATE POLICY "swms_auth_upload" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'swms-documents');

CREATE POLICY "swms_auth_read" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'swms-documents');
*/
