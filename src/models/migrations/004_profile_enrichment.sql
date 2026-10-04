-- Migration: 004_profile_enrichment
-- Deployed: 2026-10-05
-- Changes (all additive — no data is modified or dropped):
--   - employer_profiles: add alt_contact_person_name, alt_contact_person_phone (nullable)
--   - candidate_profiles: add work_experiences, educations (JSONB, default '[]')
--
-- Existing flat fields (work_experience_months, highest_education, …) are retained
-- and continue to work; the JSONB columns hold the richer resume-style records.

-- 1. Employer alternate contact (name + phone)
DO $$ BEGIN
  ALTER TABLE employer_profiles ADD COLUMN alt_contact_person_name VARCHAR(255);
EXCEPTION WHEN duplicate_column THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE employer_profiles ADD COLUMN alt_contact_person_phone VARCHAR(20);
EXCEPTION WHEN duplicate_column THEN null;
END $$;

-- 2. Candidate resume data (repeatable work experience + education)
DO $$ BEGIN
  ALTER TABLE candidate_profiles ADD COLUMN work_experiences JSONB NOT NULL DEFAULT '[]'::jsonb;
EXCEPTION WHEN duplicate_column THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE candidate_profiles ADD COLUMN educations JSONB NOT NULL DEFAULT '[]'::jsonb;
EXCEPTION WHEN duplicate_column THEN null;
END $$;
