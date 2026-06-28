import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { pool } from '../config/database';
import { config } from '../config';
import { Role, JwtPayload } from '../types';

export function generateOtp(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

function getRefreshExpiry(): Date {
  const d = new Date();
  d.setDate(d.getDate() + 30);
  return d;
}

export async function clearExpiredOtps(phone: string): Promise<void> {
  await pool.query('DELETE FROM otp_verification WHERE phone = $1', [phone]);
}

export async function createOtpRecord(phone: string, otp: string): Promise<void> {
  const otpHash = await bcrypt.hash(otp, 10);
  const expiresAt = new Date(Date.now() + config.otp.expiryMinutes * 60 * 1000);
  await pool.query(
    'INSERT INTO otp_verification (phone, otp_hash, expires_at) VALUES ($1, $2, $3)',
    [phone, otpHash, expiresAt]
  );
}

export async function sendOtp(phone: string, otp: string): Promise<void> {
  if (config.otp.smsProvider === 'console') {
    console.log(`[DEV OTP] Phone: ${phone}, OTP: ${otp}`);
  }
  // Production: integrate SMS provider (MSG91 / 2Factor / SNS) here
}

export interface OtpValidationResult {
  valid: boolean;
  error?: string;
  statusCode?: number;
}

export async function validateOtp(phone: string, otp: string): Promise<OtpValidationResult> {
  const otpResult = await pool.query(
    'SELECT * FROM otp_verification WHERE phone = $1 ORDER BY created_at DESC LIMIT 1',
    [phone]
  );

  if (otpResult.rows.length === 0) {
    return { valid: false, error: 'No OTP found. Please request a new one.', statusCode: 400 };
  }

  const otpRecord = otpResult.rows[0];

  if (new Date() > new Date(otpRecord.expires_at)) {
    await pool.query('DELETE FROM otp_verification WHERE id = $1', [otpRecord.id]);
    return { valid: false, error: 'OTP has expired. Please request a new one.', statusCode: 400 };
  }

  if (otpRecord.attempt_count >= config.otp.maxAttempts) {
    await pool.query('DELETE FROM otp_verification WHERE id = $1', [otpRecord.id]);
    return { valid: false, error: 'Too many attempts. Please request a new OTP.', statusCode: 429 };
  }

  const isValid = await bcrypt.compare(otp, otpRecord.otp_hash);
  if (!isValid) {
    await pool.query(
      'UPDATE otp_verification SET attempt_count = attempt_count + 1 WHERE id = $1',
      [otpRecord.id]
    );
    return { valid: false, error: 'Invalid OTP', statusCode: 400 };
  }

  await pool.query('DELETE FROM otp_verification WHERE phone = $1', [phone]);
  return { valid: true };
}

export async function findOrCreateUser(phone: string, requestedRole?: string): Promise<{ user: Record<string, unknown>; isNew: boolean }> {
  let userResult = await pool.query('SELECT * FROM users WHERE phone = $1', [phone]);

  if (userResult.rows.length === 0) {
    const validRoles: Role[] = ['candidate', 'employer'];
    const role: Role = validRoles.includes(requestedRole as Role) ? (requestedRole as Role) : 'candidate';
    userResult = await pool.query(
      'INSERT INTO users (phone, role) VALUES ($1, $2) RETURNING *',
      [phone, role]
    );
    return { user: userResult.rows[0], isNew: true };
  }

  return { user: userResult.rows[0], isNew: false };
}

export function generateAccessToken(userId: string, role: Role): string {
  return jwt.sign(
    { userId, role } as JwtPayload,
    config.jwt.secret,
    { expiresIn: config.jwt.accessExpiry }
  );
}

export async function generateAndStoreRefreshToken(userId: string): Promise<string> {
  const refreshToken = uuidv4();
  const refreshExpiry = getRefreshExpiry();
  await pool.query(
    'UPDATE users SET refresh_token = $1, refresh_token_expiry = $2 WHERE id = $3',
    [refreshToken, refreshExpiry, userId]
  );
  return refreshToken;
}

export async function validateRefreshToken(token: string): Promise<Record<string, unknown> | null> {
  const result = await pool.query(
    'SELECT * FROM users WHERE refresh_token = $1 AND refresh_token_expiry > NOW()',
    [token]
  );
  return result.rows.length > 0 ? result.rows[0] : null;
}

export async function revokeRefreshToken(userId: string): Promise<void> {
  await pool.query(
    'UPDATE users SET refresh_token = NULL, refresh_token_expiry = NULL WHERE id = $1',
    [userId]
  );
}
