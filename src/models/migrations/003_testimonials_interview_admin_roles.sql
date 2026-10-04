-- Migration: 003_testimonials_interview_admin_roles
-- Deployed: 2026-10-05 (PR #8 — feature/testimonials-interview)
-- Changes (all additive — no data is modified or dropped):
--   - candidate_profiles: add gender column (nullable)
--   - users: add admin_role column (super_admin | read_only; NULL for non-admins)
--   - admin_invites: add admin_role column (role assigned on sign-up; default read_only)
--   - applications: add interview_at and interview_notes columns (nullable)
--   - new table: testimonials (admin-curated, shown on homepage)
--
-- The enum change for this feature lives in 002 (must run non-transactionally).

-- 1. Gender on candidate profiles
DO $$ BEGIN
  ALTER TABLE candidate_profiles ADD COLUMN gender VARCHAR(20);
EXCEPTION WHEN duplicate_column THEN null;
END $$;

-- 2. Admin role on users (NULL = non-admin or admin without explicit role)
DO $$ BEGIN
  ALTER TABLE users ADD COLUMN admin_role VARCHAR(20);
EXCEPTION WHEN duplicate_column THEN null;
END $$;

-- 3. Admin role on invites (determines role assigned at sign-up)
DO $$ BEGIN
  ALTER TABLE admin_invites ADD COLUMN admin_role VARCHAR(20) NOT NULL DEFAULT 'read_only';
EXCEPTION WHEN duplicate_column THEN null;
END $$;

-- 4. Interview scheduling fields on applications
DO $$ BEGIN
  ALTER TABLE applications ADD COLUMN interview_at TIMESTAMP WITH TIME ZONE;
EXCEPTION WHEN duplicate_column THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE applications ADD COLUMN interview_notes TEXT;
EXCEPTION WHEN duplicate_column THEN null;
END $$;

-- 5. Testimonials table
CREATE TABLE IF NOT EXISTS testimonials (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  candidate_id   UUID REFERENCES candidate_profiles(id) ON DELETE SET NULL,
  name           VARCHAR(255) NOT NULL,
  photo_url      VARCHAR(500),
  trade          VARCHAR(100),
  body           TEXT NOT NULL,
  is_published   BOOLEAN NOT NULL DEFAULT false,
  display_order  INTEGER NOT NULL DEFAULT 0,
  created_at     TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_testimonials_published ON testimonials(is_published, display_order);

DO $$ BEGIN
  CREATE TRIGGER update_testimonials_updated_at BEFORE UPDATE ON testimonials
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
EXCEPTION WHEN duplicate_object THEN null;
END $$;
