import { pool } from '../config/database';

const migration = `
-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Role enum
DO $$ BEGIN
  CREATE TYPE user_role AS ENUM ('candidate', 'employer', 'admin');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- Employer status enum
DO $$ BEGIN
  CREATE TYPE employer_status AS ENUM ('pending', 'verified', 'rejected');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- Document type enum
DO $$ BEGIN
  CREATE TYPE employer_document_type AS ENUM ('GST_CERTIFICATE', 'UDYAM_CERTIFICATE', 'FACTORY_LICENSE', 'PAN_CARD', 'OTHER');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- Document verification status
DO $$ BEGIN
  CREATE TYPE document_verification_status AS ENUM ('pending', 'verified', 'rejected');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- Job type enum
DO $$ BEGIN
  CREATE TYPE job_type AS ENUM ('permanent', 'contract', 'internship');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- Job status enum
DO $$ BEGIN
  CREATE TYPE job_status AS ENUM ('draft', 'active', 'closed', 'filled', 'expired');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- Application status enum
DO $$ BEGIN
  CREATE TYPE application_status AS ENUM ('received', 'viewed', 'shortlisted', 'rejected', 'hired');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- Admin status enum
DO $$ BEGIN
  CREATE TYPE admin_status AS ENUM ('pending', 'approved', 'rejected');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- 1. Users table
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255),
  google_id VARCHAR(255) UNIQUE,
  role user_role NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  refresh_token TEXT,
  refresh_token_expiry TIMESTAMP WITH TIME ZONE,
  name VARCHAR(255),
  admin_status admin_status,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- 3. Candidate Profile table
CREATE TABLE IF NOT EXISTS candidate_profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  full_name VARCHAR(255) NOT NULL,
  email VARCHAR(255),
  highest_education VARCHAR(100),
  iti_trade VARCHAR(100),
  iti_college VARCHAR(255),
  department VARCHAR(100),
  graduation_year INTEGER,
  work_experience_months INTEGER,
  expected_salary INTEGER,
  skills TEXT[],
  city VARCHAR(100),
  district VARCHAR(100),
  pincode VARCHAR(10),
  photo_url VARCHAR(500),
  resume_url VARCHAR(500),
  aadhaar_url VARCHAR(500),
  iti_certificate_url VARCHAR(500),
  diploma_certificate_url VARCHAR(500),
  degree_certificate_url VARCHAR(500),
  experience_letter_url VARCHAR(500),
  aadhaar_verified BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- 4. Employer Profile table
CREATE TABLE IF NOT EXISTS employer_profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  company_name VARCHAR(255) NOT NULL,
  logo_url VARCHAR(500),
  description TEXT,
  gst_number VARCHAR(50),
  udyam_number VARCHAR(50),
  status employer_status NOT NULL DEFAULT 'pending',
  verified_by UUID REFERENCES users(id),
  verified_at TIMESTAMP WITH TIME ZONE,
  rejection_reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Add logo_url and description columns if they don't exist (for existing databases)
DO $$ BEGIN
  ALTER TABLE employer_profiles ADD COLUMN logo_url VARCHAR(500);
EXCEPTION WHEN duplicate_column THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE employer_profiles ADD COLUMN description TEXT;
EXCEPTION WHEN duplicate_column THEN null;
END $$;

-- 5. Employer Documents table
CREATE TABLE IF NOT EXISTS employer_documents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  employer_id UUID NOT NULL REFERENCES employer_profiles(id) ON DELETE CASCADE,
  document_type employer_document_type NOT NULL,
  document_url VARCHAR(500) NOT NULL,
  verification_status document_verification_status NOT NULL DEFAULT 'pending',
  uploaded_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  verified_at TIMESTAMP WITH TIME ZONE,
  verified_by UUID REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_employer_docs ON employer_documents(employer_id);

-- 6. Jobs table
CREATE TABLE IF NOT EXISTS jobs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  employer_id UUID NOT NULL REFERENCES employer_profiles(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  description TEXT NOT NULL,
  gross_salary INTEGER NOT NULL,
  net_salary INTEGER NOT NULL,
  job_type job_type NOT NULL,
  openings INTEGER NOT NULL DEFAULT 1,
  filled_count INTEGER NOT NULL DEFAULT 0,
  trade_required VARCHAR(100),
  district VARCHAR(100) NOT NULL,
  status job_status NOT NULL DEFAULT 'active',
  posted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_jobs_employer ON jobs(employer_id);
CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status);
CREATE INDEX IF NOT EXISTS idx_jobs_district ON jobs(district);

-- 7. Applications table
CREATE TABLE IF NOT EXISTS applications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  candidate_id UUID NOT NULL REFERENCES candidate_profiles(id) ON DELETE CASCADE,
  job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  status application_status NOT NULL DEFAULT 'received',
  viewed_at TIMESTAMP WITH TIME ZONE,
  shortlisted_at TIMESTAMP WITH TIME ZONE,
  rejected_at TIMESTAMP WITH TIME ZONE,
  hired_at TIMESTAMP WITH TIME ZONE,
  rejection_reason TEXT,
  attributed_to_platform BOOLEAN NOT NULL DEFAULT false,
  joining_date DATE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  UNIQUE(candidate_id, job_id)
);

CREATE INDEX IF NOT EXISTS idx_applications_candidate ON applications(candidate_id);
CREATE INDEX IF NOT EXISTS idx_applications_job ON applications(job_id);

-- 8. Translation cache
CREATE TABLE IF NOT EXISTS translation_cache (
  source_hash CHAR(64) NOT NULL,
  target_lang VARCHAR(10) NOT NULL,
  translated_text TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  PRIMARY KEY (source_hash, target_lang)
);

-- Updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply updated_at triggers
DO $$ BEGIN
  CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TRIGGER update_candidate_profiles_updated_at BEFORE UPDATE ON candidate_profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TRIGGER update_employer_profiles_updated_at BEFORE UPDATE ON employer_profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TRIGGER update_jobs_updated_at BEFORE UPDATE ON jobs
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TRIGGER update_applications_updated_at BEFORE UPDATE ON applications
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
EXCEPTION WHEN duplicate_object THEN null;
END $$;
`;

async function migrate() {
  console.log('Running database migration...');
  try {
    await pool.query(migration);
    console.log('Migration completed successfully.');
  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

migrate();
