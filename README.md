# Alwar Rojgar Setu — Backend API

Express + PostgreSQL backend for the Alwar Rojgar Setu job portal.

## Tech Stack

- **Runtime:** Node.js 18+
- **Framework:** Express.js
- **Database:** PostgreSQL 15
- **Auth:** JWT + OTP (phone-based login)
- **File Uploads:** Multer (local disk)
- **Language:** TypeScript

## Quick Start

### 1. Start PostgreSQL (Docker)

```bash
docker compose up -d
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Run Database Migration

```bash
npm run db:migrate
```

### 4. Seed Admin User (optional)

```bash
npm run db:seed
```

### 5. Start Dev Server

```bash
npm run dev
```

Server runs at `http://localhost:4000`. API base: `/api/v1`.

## Environment Variables

Copy `.env.example` to `.env` and adjust values:

```bash
cp .env.example .env
```

## API Endpoints

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | /api/v1/auth/otp/request | - | Request OTP |
| POST | /api/v1/auth/otp/verify | - | Verify OTP, get tokens |
| POST | /api/v1/auth/token/refresh | Cookie | Refresh access token |
| POST | /api/v1/auth/logout | JWT | Logout |
| GET | /api/v1/users/current | JWT | Current user info |
| POST | /api/v1/candidate-profile | Candidate | Create profile |
| GET | /api/v1/candidate-profile | Candidate | Get profile |
| PATCH | /api/v1/candidate-profile | Candidate | Update profile |
| POST | /api/v1/candidate-profile/resume | Candidate | Upload resume |
| POST | /api/v1/candidate-profile/aadhaar | Candidate | Upload Aadhaar |
| POST | /api/v1/candidate-profile/certificates | Candidate | Upload certificate |
| GET | /api/v1/candidate-profile/applications | Candidate | My applications |
| POST | /api/v1/employer-profile | Employer | Create profile |
| GET | /api/v1/employer-profile | Employer | Get profile |
| PATCH | /api/v1/employer-profile | Employer | Update profile |
| GET | /api/v1/employer-profile/documents | Employer | List documents |
| POST | /api/v1/employer-profile/documents | Employer | Upload document |
| DELETE | /api/v1/employer-profile/documents/:id | Employer | Delete document |
| GET | /api/v1/jobs | Public | Search jobs |
| GET | /api/v1/jobs/:jobId | Public | Job details |
| GET | /api/v1/jobs/owned | Employer | My posted jobs |
| POST | /api/v1/jobs | Employer | Create job |
| PATCH | /api/v1/jobs/:jobId | Employer | Update job |
| PATCH | /api/v1/jobs/:jobId/close | Employer | Close job |
| GET | /api/v1/jobs/:jobId/applications | Employer/Admin | Job applicants |
| POST | /api/v1/job-applications | Candidate | Apply to job |
| PATCH | /api/v1/job-applications/:id/status | Employer/Admin | Update app status |
| GET | /api/v1/admin/dashboard | Admin | Dashboard metrics |
| GET | /api/v1/admin/employers | Admin | List employers |
| GET | /api/v1/admin/employers/:id | Admin | Employer detail |
| PATCH | /api/v1/admin/employers/:id/verification | Admin | Verify/reject |
| GET | /api/v1/admin/candidates | Admin | List candidates |
| GET | /api/v1/admin/candidates/:id | Admin | Candidate detail |
| PATCH | /api/v1/admin/users/:id/disable | Admin | Disable user |
| PATCH | /api/v1/admin/users/:id/enable | Admin | Enable user |
| GET | /api/v1/stats | Public | Homepage stats |

## Development

- OTP in dev mode is logged to console (no SMS sent)
- Default dev OTP: check console output
- Admin seed phone: `+919999999999`
