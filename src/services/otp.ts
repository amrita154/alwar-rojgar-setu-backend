import crypto from 'crypto';
import { pool } from '../config/database';
import { sendOtpEmail } from './email';
import { Role } from '../types';

const OTP_EXPIRY_MINUTES = 10;
const MAX_VERIFY_ATTEMPTS = 5;
const MAX_SENDS_PER_24H = 10; // per email — protects SMTP quota without restricting UX

function generateOtpCode(): string {
  return crypto.randomInt(100000, 999999).toString();
}

function hashOtp(otp: string): string {
  return crypto.createHash('sha256').update(otp).digest('hex');
}

function timingSafeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(Buffer.from(a, 'hex'), Buffer.from(b, 'hex'));
}

export class OtpDailyLimitError extends Error {
  constructor() {
    super('Daily OTP limit reached');
    this.name = 'OtpDailyLimitError';
  }
}

export interface OtpVerifyResult {
  valid: boolean;
  error?: string;
  statusCode?: number;
}

export interface PendingRegistration {
  passwordHash: string;
  role: Role;
}

/**
 * Generate and send a 6-digit OTP.
 *
 * Protection layers (backend):
 *  1. Per-email DB cap: max 10 sends per email per 24 hours.
 *  2. IP rate limiter (registerLimiter): max 5 requests/hour per IP — applied at the route.
 *  3. Global limiter: 200 requests/15min across all endpoints.
 *
 * Expired unused OTPs are cleaned up on each call to keep the table lean.
 * verify() always picks the latest unused OTP (ORDER BY created_at DESC).
 */
async function checkAndCleanOtps(email: string, purpose: string): Promise<void> {
  const countResult = await pool.query(
    `SELECT COUNT(*) FROM email_otps
     WHERE email = $1 AND purpose = $2 AND created_at > NOW() - INTERVAL '24 hours'`,
    [email, purpose]
  );
  if (parseInt(countResult.rows[0].count, 10) >= MAX_SENDS_PER_24H) {
    throw new OtpDailyLimitError();
  }
  await pool.query(
    `DELETE FROM email_otps WHERE email = $1 AND purpose = $2 AND expires_at < NOW() AND used_at IS NULL`,
    [email, purpose]
  );
}

export async function generateAndSendOtp(
  email: string,
  passwordHash: string,
  role: Role
): Promise<void> {
  await checkAndCleanOtps(email, 'registration');

  const otp = generateOtpCode();
  const otpHash = hashOtp(otp);
  const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);

  await pool.query(
    `INSERT INTO email_otps (email, otp_code_hash, password_hash, role, purpose, expires_at)
     VALUES ($1, $2, $3, $4, 'registration', $5)`,
    [email, otpHash, passwordHash, role, expiresAt]
  );

  await sendOtpEmail(email, otp, 'registration');
}

/** Send a password-reset OTP. Does not store any password — that comes at reset time. */
export async function generateAndSendResetOtp(email: string): Promise<void> {
  await checkAndCleanOtps(email, 'password_reset');

  const otp = generateOtpCode();
  const otpHash = hashOtp(otp);
  const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);

  await pool.query(
    `INSERT INTO email_otps (email, otp_code_hash, purpose, expires_at)
     VALUES ($1, $2, 'password_reset', $3)`,
    [email, otpHash, expiresAt]
  );

  await sendOtpEmail(email, otp, 'password_reset');
}

/**
 * Verify a submitted OTP for the given email.
 * Picks the latest unused (and non-expired) OTP.
 * - Increments attempts on every call to prevent brute-force.
 * - Marks used_at on success to prevent replay.
 * - Locks out after MAX_VERIFY_ATTEMPTS wrong guesses.
 */
export async function verifyOtp(email: string, submittedOtp: string): Promise<OtpVerifyResult> {
  const result = await pool.query(
    `SELECT * FROM email_otps
     WHERE email = $1 AND purpose = 'registration' AND used_at IS NULL
     ORDER BY created_at DESC
     LIMIT 1`,
    [email]
  );

  if (result.rows.length === 0) {
    return { valid: false, error: 'No pending verification found. Please request a new code.', statusCode: 400 };
  }

  const record = result.rows[0];

  if (new Date(record.expires_at) < new Date()) {
    return { valid: false, error: 'Verification code has expired. Please request a new one.', statusCode: 400 };
  }

  if (record.attempts >= MAX_VERIFY_ATTEMPTS) {
    return { valid: false, error: 'Too many incorrect attempts. Please request a new code.', statusCode: 429 };
  }

  await pool.query(
    `UPDATE email_otps SET attempts = attempts + 1 WHERE id = $1`,
    [record.id]
  );

  const submittedHash = hashOtp(submittedOtp);
  if (!timingSafeCompare(record.otp_code_hash, submittedHash)) {
    return { valid: false, error: 'Invalid verification code. Please try again.', statusCode: 400 };
  }

  await pool.query(
    `UPDATE email_otps SET used_at = NOW() WHERE id = $1`,
    [record.id]
  );

  return { valid: true };
}

/** Verify a password-reset OTP. Returns the OTP record id on success for downstream reset. */
export async function verifyResetOtp(email: string, submittedOtp: string): Promise<OtpVerifyResult & { otpId?: string }> {
  const result = await pool.query(
    `SELECT * FROM email_otps
     WHERE email = $1 AND purpose = 'password_reset' AND used_at IS NULL
     ORDER BY created_at DESC
     LIMIT 1`,
    [email]
  );

  if (result.rows.length === 0) {
    return { valid: false, error: 'No pending reset request found. Please request a new code.', statusCode: 400 };
  }

  const record = result.rows[0];

  if (new Date(record.expires_at) < new Date()) {
    return { valid: false, error: 'Reset code has expired. Please request a new one.', statusCode: 400 };
  }

  if (record.attempts >= MAX_VERIFY_ATTEMPTS) {
    return { valid: false, error: 'Too many incorrect attempts. Please request a new reset code.', statusCode: 429 };
  }

  await pool.query(`UPDATE email_otps SET attempts = attempts + 1 WHERE id = $1`, [record.id]);

  const submittedHash = hashOtp(submittedOtp);
  if (!timingSafeCompare(record.otp_code_hash, submittedHash)) {
    return { valid: false, error: 'Invalid reset code. Please try again.', statusCode: 400 };
  }

  await pool.query(`UPDATE email_otps SET used_at = NOW() WHERE id = $1`, [record.id]);

  return { valid: true, otpId: record.id };
}

/**
 * After successful OTP verification, retrieve the pending registration data.
 * Only works on records that were just marked used (used_at within last 30 seconds).
 */
export async function getPendingRegistration(email: string): Promise<PendingRegistration | null> {
  const result = await pool.query(
    `SELECT password_hash, role FROM email_otps
     WHERE email = $1 AND used_at IS NOT NULL AND used_at > NOW() - INTERVAL '30 seconds'
     ORDER BY used_at DESC
     LIMIT 1`,
    [email]
  );

  if (result.rows.length === 0) return null;

  const row = result.rows[0];
  return {
    passwordHash: row.password_hash,
    role: row.role as Role,
  };
}
