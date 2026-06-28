# Database Documentation

PostgreSQL 15. UUID primary keys via `uuid-ossp` extension.

---

## Enums

| Enum | Values |
|------|--------|
| `user_role` | `candidate`, `employer`, `admin` |
| `employer_status` | `pending`, `verified`, `rejected` |
| `employer_document_type` | `GST_CERTIFICATE`, `UDYAM_CERTIFICATE`, `FACTORY_LICENSE`, `PAN_CARD`, `OTHER` |
| `document_verification_status` | `pending`, `verified`, `rejected` |
| `job_type` | `permanent`, `contract`, `internship` |
| `job_status` | `draft`, `active`, `closed`, `filled`, `expired` |
| `application_status` | `received`, `viewed`, `shortlisted`, `rejected`, `hired` |

---

## Tables

### `users`
Authentication root table. One row per phone number.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | UUID | PK, default `uuid_generate_v4()` | |
| `phone` | VARCHAR(15) | NOT NULL, UNIQUE | E.164 format |
| `role` | `user_role` | NOT NULL | |
| `is_active` | BOOLEAN | NOT NULL, default `true` | |
| `refresh_token` | TEXT | nullable | Hashed JWT refresh token |
| `refresh_token_expiry` | TIMESTAMPTZ | nullable | |
| `created_at` | TIMESTAMPTZ | NOT NULL, default `NOW()` | |
| `updated_at` | TIMESTAMPTZ | NOT NULL, default `NOW()` | auto-updated via trigger |

---

### `otp_verification`
Short-lived OTP records for phone auth. Not linked to `users` by FK — phone may not yet have a user row.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | UUID | PK | |
| `phone` | VARCHAR(15) | NOT NULL | |
| `otp_hash` | VARCHAR(255) | NOT NULL | bcrypt hash |
| `expires_at` | TIMESTAMPTZ | NOT NULL | |
| `attempt_count` | INTEGER | NOT NULL, default `0` | rate-limit guard |
| `created_at` | TIMESTAMPTZ | NOT NULL, default `NOW()` | |

**Indexes:** `idx_otp_phone` on `phone`

---

### `candidate_profiles`
1:1 with `users` (role = `candidate`).

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | UUID | PK | |
| `user_id` | UUID | NOT NULL, UNIQUE, FK → `users.id` CASCADE | |
| `full_name` | VARCHAR(255) | NOT NULL | |
| `email` | VARCHAR(255) | nullable | |
| `highest_education` | VARCHAR(100) | nullable | |
| `iti_trade` | VARCHAR(100) | nullable | |
| `iti_college` | VARCHAR(255) | nullable | |
| `department` | VARCHAR(100) | nullable | |
| `graduation_year` | INTEGER | nullable | |
| `work_experience_months` | INTEGER | nullable | |
| `expected_salary` | INTEGER | nullable | INR/month |
| `skills` | TEXT[] | nullable | Postgres array |
| `city` | VARCHAR(100) | nullable | |
| `district` | VARCHAR(100) | nullable | |
| `pincode` | VARCHAR(10) | nullable | |
| `photo_url` | VARCHAR(500) | nullable | |
| `resume_url` | VARCHAR(500) | nullable | |
| `aadhaar_url` | VARCHAR(500) | nullable | |
| `iti_certificate_url` | VARCHAR(500) | nullable | |
| `diploma_certificate_url` | VARCHAR(500) | nullable | |
| `degree_certificate_url` | VARCHAR(500) | nullable | |
| `experience_letter_url` | VARCHAR(500) | nullable | |
| `aadhaar_verified` | BOOLEAN | NOT NULL, default `false` | |
| `created_at` | TIMESTAMPTZ | NOT NULL, default `NOW()` | |
| `updated_at` | TIMESTAMPTZ | NOT NULL, default `NOW()` | auto-updated via trigger |

---

### `employer_profiles`
1:1 with `users` (role = `employer`). Must be verified by admin before posting jobs.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | UUID | PK | |
| `user_id` | UUID | NOT NULL, UNIQUE, FK → `users.id` CASCADE | |
| `company_name` | VARCHAR(255) | NOT NULL | |
| `gst_number` | VARCHAR(50) | nullable | |
| `udyam_number` | VARCHAR(50) | nullable | MSME registration |
| `status` | `employer_status` | NOT NULL, default `pending` | |
| `verified_by` | UUID | nullable, FK → `users.id` | admin who verified |
| `verified_at` | TIMESTAMPTZ | nullable | |
| `rejection_reason` | TEXT | nullable | |
| `created_at` | TIMESTAMPTZ | NOT NULL, default `NOW()` | |
| `updated_at` | TIMESTAMPTZ | NOT NULL, default `NOW()` | auto-updated via trigger |

---

### `employer_documents`
Supporting docs uploaded by employer for verification. Many per employer.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | UUID | PK | |
| `employer_id` | UUID | NOT NULL, FK → `employer_profiles.id` CASCADE | |
| `document_type` | `employer_document_type` | NOT NULL | |
| `document_url` | VARCHAR(500) | NOT NULL | |
| `verification_status` | `document_verification_status` | NOT NULL, default `pending` | |
| `uploaded_at` | TIMESTAMPTZ | NOT NULL, default `NOW()` | |
| `verified_at` | TIMESTAMPTZ | nullable | |
| `verified_by` | UUID | nullable, FK → `users.id` | |

**Indexes:** `idx_employer_docs` on `employer_id`

---

### `jobs`
Job postings. Only verified employers can post.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | UUID | PK | |
| `employer_id` | UUID | NOT NULL, FK → `employer_profiles.id` CASCADE | |
| `title` | VARCHAR(255) | NOT NULL | |
| `description` | TEXT | NOT NULL | |
| `gross_salary` | INTEGER | NOT NULL | INR/month |
| `net_salary` | INTEGER | NOT NULL | INR/month |
| `job_type` | `job_type` | NOT NULL | |
| `openings` | INTEGER | NOT NULL, default `1` | total seats |
| `filled_count` | INTEGER | NOT NULL, default `0` | hired count |
| `trade_required` | VARCHAR(100) | nullable | ITI trade |
| `district` | VARCHAR(100) | NOT NULL | location |
| `status` | `job_status` | NOT NULL, default `active` | |
| `posted_at` | TIMESTAMPTZ | default `NOW()` | |
| `created_at` | TIMESTAMPTZ | NOT NULL, default `NOW()` | |
| `updated_at` | TIMESTAMPTZ | NOT NULL, default `NOW()` | auto-updated via trigger |

**Indexes:** `idx_jobs_employer`, `idx_jobs_status`, `idx_jobs_district`

---

### `applications`
Candidate applies to job. One application per (candidate, job) pair.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | UUID | PK | |
| `candidate_id` | UUID | NOT NULL, FK → `candidate_profiles.id` CASCADE | |
| `job_id` | UUID | NOT NULL, FK → `jobs.id` CASCADE | |
| `status` | `application_status` | NOT NULL, default `received` | |
| `viewed_at` | TIMESTAMPTZ | nullable | employer opened it |
| `shortlisted_at` | TIMESTAMPTZ | nullable | |
| `rejected_at` | TIMESTAMPTZ | nullable | |
| `hired_at` | TIMESTAMPTZ | nullable | |
| `rejection_reason` | TEXT | nullable | |
| `attributed_to_platform` | BOOLEAN | NOT NULL, default `false` | impact tracking |
| `joining_date` | DATE | nullable | confirmed start date |
| `created_at` | TIMESTAMPTZ | NOT NULL, default `NOW()` | |
| `updated_at` | TIMESTAMPTZ | NOT NULL, default `NOW()` | auto-updated via trigger |

**Unique:** `(candidate_id, job_id)` — one application per job  
**Indexes:** `idx_applications_candidate`, `idx_applications_job`

---

## Relationships

```
users ──< candidate_profiles  (1:1, user_id FK)
users ──< employer_profiles   (1:1, user_id FK)
employer_profiles ──< employer_documents  (1:N, employer_id FK)
employer_profiles ──< jobs                (1:N, employer_id FK)
candidate_profiles ──< applications       (1:N, candidate_id FK)
jobs ──< applications                     (1:N, job_id FK)
users ──< employer_profiles.verified_by   (admin who verified)
users ──< employer_documents.verified_by  (admin who verified doc)
```

---

## Triggers

`update_updated_at_column()` — BEFORE UPDATE trigger applied to:
- `users`
- `candidate_profiles`
- `employer_profiles`
- `jobs`
- `applications`

---

## Seed Data

Dev seed creates one admin user:
- Phone: `+919999999999`
- Role: `admin`
- Dev OTP (all users): `123456`

Run: `npm run db:seed`

---

## Connection

Configured via env vars (see `.env.example`). Docker Compose spins up Postgres 15 on port `5432`.

```
POSTGRES_DB=alwar_rojgar_setu
POSTGRES_USER=postgres
POSTGRES_PASSWORD=postgres
```
