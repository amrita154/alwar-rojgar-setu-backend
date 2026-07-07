export type Role = 'candidate' | 'employer' | 'admin';
export type EmployerStatus = 'pending' | 'verified' | 'rejected';
export type EmployerDocumentType = 'GST_CERTIFICATE' | 'UDYAM_CERTIFICATE' | 'FACTORY_LICENSE' | 'PAN_CARD' | 'OTHER';
export type DocumentVerificationStatus = 'pending' | 'verified' | 'rejected';
export type JobType = 'permanent' | 'contract' | 'internship';
export type JobStatus = 'draft' | 'active' | 'closed' | 'filled' | 'expired';
export type ApplicationStatus = 'received' | 'viewed' | 'shortlisted' | 'rejected' | 'hired';
export type CertificateType = 'ITI_CERTIFICATE' | 'DIPLOMA_CERTIFICATE' | 'DEGREE_CERTIFICATE' | 'EXPERIENCE_LETTER';

export interface User {
  id: string;
  phone: string;
  role: Role;
  is_active: boolean;
  refresh_token: string | null;
  refresh_token_expiry: Date | null;
  created_at: Date;
  updated_at: Date;
}

export interface OtpVerification {
  id: string;
  phone: string;
  otp_hash: string;
  expires_at: Date;
  attempt_count: number;
  created_at: Date;
}

export interface CandidateProfile {
  id: string;
  user_id: string;
  full_name: string;
  email: string | null;
  highest_education: string | null;
  iti_trade: string | null;
  iti_college: string | null;
  department: string | null;
  graduation_year: number | null;
  work_experience_months: number | null;
  expected_salary: number | null;
  skills: string[] | null;
  city: string | null;
  district: string | null;
  pincode: string | null;
  photo_url: string | null;
  resume_url: string | null;
  aadhaar_url: string | null;
  iti_certificate_url: string | null;
  diploma_certificate_url: string | null;
  degree_certificate_url: string | null;
  experience_letter_url: string | null;
  aadhaar_verified: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface EmployerProfileRow {
  id: string;
  user_id: string;
  company_name: string;
  logo_url: string | null;
  description: string | null;
  gst_number: string | null;
  udyam_number: string | null;
  status: EmployerStatus;
  verified_by: string | null;
  verified_at: Date | null;
  rejection_reason: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface EmployerDocumentRow {
  id: string;
  employer_id: string;
  document_type: EmployerDocumentType;
  document_url: string;
  verification_status: DocumentVerificationStatus;
  uploaded_at: Date;
  verified_at: Date | null;
  verified_by: string | null;
}

export interface JobRow {
  id: string;
  employer_id: string;
  title: string;
  description: string;
  gross_salary: number;
  net_salary: number;
  job_type: JobType;
  openings: number;
  filled_count: number;
  trade_required: string | null;
  district: string;
  status: JobStatus;
  posted_at: Date | null;
  created_at: Date;
  updated_at: Date;
  company_name?: string;
}

export interface ApplicationRow {
  id: string;
  candidate_id: string;
  job_id: string;
  status: ApplicationStatus;
  viewed_at: Date | null;
  shortlisted_at: Date | null;
  rejected_at: Date | null;
  hired_at: Date | null;
  rejection_reason: string | null;
  attributed_to_platform: boolean;
  joining_date: Date | null;
  created_at: Date;
  updated_at: Date;
}

export interface Paginated<T> {
  data: T[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface JwtPayload {
  userId: string;
  role: Role;
}
