# Alwar Rojgar Setu — Backend API Reference

**Base URL:** `http://localhost:4000/api/v1`

---

## Overview

Job portal backend for Alwar district. Three roles: **candidate**, **employer**, **admin**.

### Auth Model
- Login is OTP-based (phone number). No passwords.
- On verify: `accessToken` returned in response body, `refreshToken` set as httpOnly cookie.
- All protected routes: `Authorization: Bearer <accessToken>` header.
- Access token expires in 1h. Refresh with `/auth/token/refresh`.

### Response Shape (paginated)
```json
{
  "data": [...],
  "page": 1,
  "limit": 20,
  "total": 100,
  "totalPages": 5
}
```

### Error Shape
```json
{ "message": "Human-readable error" }
```

---

## Auth — `/api/v1/auth`

### POST `/auth/otp/request`
Send OTP to phone. Creates user if first time.

**Body:**
```json
{ "phone": "9876543210", "role": "candidate" }
```
> `role` — `"candidate"` | `"employer"`. Ignored if user already exists. Required on first signup.

**Response:** `200 { "message": "OTP sent successfully" }`

**Rate limits:**
- Max **3 requests per phone** per 10 minutes
- Max **10 requests per IP** per 10 minutes
- Exceeding either returns `429` with a descriptive message

---

### POST `/auth/otp/verify`
Verify OTP and get tokens.

**Body:**
```json
{ "phone": "9876543210", "otp": "123456", "role": "candidate" }
```

**Response:**
```json
{ "accessToken": "eyJ..." }
```
> `refreshToken` set in httpOnly cookie automatically.

---

### POST `/auth/token/refresh`
Get new access token using refresh cookie.

**No body.** Cookie sent automatically by browser.

**Response:** `{ "accessToken": "eyJ..." }`

---

### POST `/auth/logout` 🔒
Revoke refresh token, clear cookie.

**Response:** `{ "message": "Logged out successfully" }`

---

## Users — `/api/v1/users`

### GET `/users/current` 🔒
Get current user identity. Use this after login to decide routing.

**Response:**
```json
{
  "userId": "uuid",
  "role": "candidate",
  "profileCompleted": true,
  "isActive": true
}
```
> Use `profileCompleted` to redirect to profile setup if `false`.

---

## Candidate Profile — `/api/v1/candidate-profile`
> All routes require: **candidate** role

### POST `/candidate-profile`
Create profile (one per user).

**Body:**
```json
{
  "fullName": "Ramesh Kumar",
  "email": "ramesh@example.com",
  "highestEducation": "ITI",
  "itiTrade": "Electrician",
  "itiCollege": "Govt ITI Alwar",
  "department": "Electrical",
  "graduationYear": 2022,
  "workExperienceMonths": 12,
  "expectedSalary": 15000,
  "skills": ["Wiring", "Panel Work"],
  "city": "Alwar",
  "district": "Alwar",
  "pincode": "301001"
}
```
> Only `fullName` is required. All other fields optional.

**Response:** `201` — created profile object

---

### GET `/candidate-profile`
Get own profile.

**Response:** Profile object (camelCase keys)

---

### PATCH `/candidate-profile`
Update profile fields (partial update).

**Body:** Any subset of profile fields (camelCase).

**Response:** Updated profile object

---

### POST `/candidate-profile/resume` — multipart/form-data
Upload resume PDF/image.

**Form field:** `file`

**Response:** `{ "resumeUrl": "/uploads/filename.pdf", ... }`

---

### POST `/candidate-profile/aadhaar` — multipart/form-data
Upload Aadhaar card image.

**Form field:** `file`

---

### POST `/candidate-profile/certificates` — multipart/form-data
Upload certificates/letters.

**Form fields:** `file`, `documentType`

**documentType values:**
- `ITI_CERTIFICATE`
- `DIPLOMA_CERTIFICATE`
- `DEGREE_CERTIFICATE`
- `EXPERIENCE_LETTER`

---

### GET `/candidate-profile/applications`
List own job applications.

**Query params:**
- `status` — filter by status: `received` | `viewed` | `shortlisted` | `rejected` | `hired`
- `page`, `limit`

**Response:** Paginated list of applications with job details

---

## Employer Profile — `/api/v1/employer-profile`
> All routes require: **employer** role

### POST `/employer-profile`
Create employer profile.

**Body:**
```json
{
  "companyName": "ABC Industries",
  "gstNumber": "07AAACB1234F1ZY",
  "udyamNumber": "UDYAM-RJ-01-0012345"
}
```
> Only `companyName` required. Status starts as `pending` — admin must verify before posting jobs.

---

### GET `/employer-profile`
Get own profile (includes verification status).

---

### PATCH `/employer-profile`
Update profile fields.

---

### GET `/employer-profile/documents`
List uploaded verification documents.

---

### POST `/employer-profile/documents` — multipart/form-data
Upload a verification document.

**Form fields:** `file`, `documentType`

**documentType values:** `GST_CERTIFICATE` | `UDYAM_CERTIFICATE` | `FACTORY_LICENSE` | `PAN_CARD` | `OTHER`

**Response:** `201` — document record

---

### DELETE `/employer-profile/documents/:documentId`
Remove a document.

**Response:** `204` No Content

---

## Jobs — `/api/v1/jobs`

### GET `/jobs` — Public
Search/browse jobs.

**Query params:**
- `district` — filter by district
- `tradeRequired` — e.g. `"Electrician"`
- `jobType` — `permanent` | `contract` | `internship`
- `minSalary`, `maxSalary` — integer (INR/month)
- `page`, `limit`

**Response:** Paginated job listings (includes `companyName`)

---

### GET `/jobs/:jobId` — Public
Get single job details.

---

### GET `/jobs/owned` 🔒 employer
List jobs posted by the logged-in employer.

---

### POST `/jobs` 🔒 employer
Post a new job. Employer profile must exist (status doesn't block posting — enforce on frontend if needed).

**Body:**
```json
{
  "title": "Electrician",
  "description": "Panel wiring work...",
  "grossSalary": 20000,
  "netSalary": 18000,
  "jobType": "permanent",
  "openings": 3,
  "tradeRequired": "Electrician",
  "district": "Alwar"
}
```
> Required: `title`, `description`, `grossSalary`, `netSalary`, `jobType`, `district`

**Response:** `201` — job object

---

### PATCH `/jobs/:jobId` 🔒 employer
Update job (only owner can edit).

**Body:** Any updatable fields.

---

### PATCH `/jobs/:jobId/close` 🔒 employer
Close a job posting.

**Response:** Updated job with `status: "closed"`

---

### GET `/jobs/:jobId/applications` 🔒 employer | admin
List all applicants for a job. Employer can only access own jobs.

---

## Job Applications — `/api/v1/job-applications`

### POST `/job-applications` 🔒 candidate
Apply to a job. Candidate must have a profile. Duplicate applications blocked.

**Body:**
```json
{ "jobId": "uuid" }
```

**Response:** `201` — application record

---

### PATCH `/job-applications/:applicationId/status` 🔒 employer | admin
Update application status.

**Body:**
```json
{
  "status": "shortlisted",
  "reason": "Strong ITI background",
  "attributedToPlatform": true,
  "joiningDate": "2025-08-01"
}
```

**status values:** `received` → `viewed` → `shortlisted` → `hired` | `rejected`

> `reason` — used when rejecting. `joiningDate` — used when hiring. `attributedToPlatform` — boolean tracking.

---

## Admin — `/api/v1/admin`
> All routes require: **admin** role

### GET `/admin/dashboard`
Platform metrics.

**Response:**
```json
{
  "totalCandidates": 120,
  "totalEmployers": 30,
  "pendingEmployers": 5,
  "activeJobs": 45,
  "totalApplications": 300,
  "successfulHires": 18
}
```

---

### GET `/admin/employers`
List all employers with filters.

**Query:** `status` (`pending`|`verified`|`rejected`), `search`, `page`, `limit`

---

### GET `/admin/employers/:employerId`
Single employer detail with documents.

---

### PATCH `/admin/employers/:employerId/verification`
Approve or reject employer.

**Body:**
```json
{ "status": "verified" }
```
or
```json
{ "status": "rejected", "reason": "Invalid GST number" }
```

---

### GET `/admin/candidates`
List all candidates.

**Query:** `search`, `department`, `page`, `limit`

---

### GET `/admin/candidates/:candidateId`
Single candidate detail.

---

### PATCH `/admin/users/:userId/disable`
Disable a user account (blocks login).

### PATCH `/admin/users/:userId/enable`
Re-enable a user account.

---

## Stats — `/api/v1/stats`

### GET `/stats` — Public
Homepage stats counter.

**Response:**
```json
{
  "activeJobs": 45,
  "registeredEmployers": 28,
  "successfulHires": 18
}
```

---

## Health

### GET `/api/v1/health` — Public
```json
{ "status": "ok", "timestamp": "2025-01-01T00:00:00.000Z" }
```

---

## Documents — `/api/v1/documents`

### GET `/documents/:filename` 🔒
Fetch an uploaded file (resume, Aadhaar, certificate, employer document).

**Access rules:**
- **Candidate** — can fetch their own files only
- **Employer** — can fetch files of candidates who have applied to one of their jobs
- **Admin** — can fetch any file

**Response:** File binary (PDF / image)

**Errors:**
- `403` — file exists but requester has no access
- `404` — filename not found in any profile

> All file URLs returned by upload endpoints (e.g. `resumeUrl`, `documentUrl`) use the filename component: `GET /api/v1/documents/<filename>`. Do **not** fetch `/uploads/...` directly — that path is not served.

---

## File Uploads
- Max size: 5MB per file
- Allowed types: PDF, JPEG, PNG, WEBP, DOC, DOCX
- Use `multipart/form-data` with field name `file`
- After upload, retrieve files via `GET /api/v1/documents/:filename` with a valid Bearer token

---

## Frontend Integration Notes

### Typical Candidate Flow
1. `POST /auth/otp/request` → `POST /auth/otp/verify` → store `accessToken`
2. `GET /users/current` → check `profileCompleted`
3. If not completed → `POST /candidate-profile`
4. Upload docs → `POST /candidate-profile/resume`, `/aadhaar`, `/certificates`
5. Browse jobs → `GET /jobs` (public, no token needed)
6. Apply → `POST /job-applications`
7. Track → `GET /candidate-profile/applications`

### Typical Employer Flow
1. Auth same as above with `role: "employer"`
2. `POST /employer-profile` → upload docs → wait for admin approval
3. Once verified: `POST /jobs` to post listings
4. `GET /jobs/owned` → manage listings
5. `GET /jobs/:jobId/applications` → review applicants
6. `PATCH /job-applications/:id/status` → shortlist/hire/reject

### Fetching Uploaded Files
File URLs returned by upload endpoints (e.g. `resumeUrl: "/uploads/abc.pdf"`) contain only the filename after the last `/`. To render a file:

```js
// Extract filename from the stored URL
const filename = resumeUrl.split('/').pop();

// Fetch with auth
const res = await fetch(`/api/v1/documents/${filename}`, {
  headers: { Authorization: `Bearer ${accessToken}` },
});
const blob = await res.blob();
const objectUrl = URL.createObjectURL(blob);
// Use objectUrl in <img src> or <a href> or window.open
```

For `<img>` tags you cannot set headers directly — fetch the blob first and use `URL.createObjectURL`.

### Token Refresh Strategy
- Store `accessToken` in memory (not localStorage — XSS risk)
- On 401 response → call `POST /auth/token/refresh` (cookie sent automatically)
- Retry original request with new token
- On refresh failure → redirect to login
