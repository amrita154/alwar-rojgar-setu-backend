import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { pool } from '../config/database';
import { config } from '../config';
import { Role, JwtPayload } from '../types';

// Demo accounts always get a fixed OTP so live demos work without real SMS.
export const DEMO_OTP = '123456';
const DEMO_PHONES = new Set([
  '+911111111111', // demo employer
  '+912222222222', // demo job seeker
]);

export function generateOtp(phone?: string): string {
  if (phone && DEMO_PHONES.has(phone)) return DEMO_OTP;
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

function toMobile(phone: string): string {
  const digits = phone.replace(/^\+/, '');
  return digits.startsWith('91') ? digits : `91${digits}`;
}

function msg91AuthKey(): string {
  const key = process.env.MSG91_AUTH_KEY;
  if (!key) throw new Error('MSG91_AUTH_KEY not set');
  return key;
}

export async function sendOtp(phone: string): Promise<void> {
  console.log(`[OTP] sendOtp called | provider=${config.otp.smsProvider} | phone=${phone}`);

  if (config.otp.smsProvider === 'console') {
    const otp = generateOtp(phone);
    console.log(`[OTP] Generating OTP locally for ${phone}`);
    await clearExpiredOtps(phone);
    console.log(`[OTP] Cleared old OTP records for ${phone}`);
    await createOtpRecord(phone, otp);
    console.log(`[OTP] Stored OTP record in DB for ${phone}`);
    console.log(`[DEV OTP] Phone: ${phone}, OTP: ${otp}`);
    return;
  }

  const mobile = toMobile(phone);
  console.log(`[MSG91] Sending OTP request | mobile=${mobile}`);

  const resp = await fetch('https://control.msg91.com/api/v5/otp', {
    method: 'POST',
    headers: { authkey: msg91AuthKey(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ mobile }),
  });

  const body = await resp.json() as { type: string; message: string; otp?: string };
  console.log(`[MSG91] sendOtp response | status=${resp.status} | body=${JSON.stringify(body)}`);

  if (!resp.ok || body.type !== 'success') {
    console.error(`[MSG91] sendOtp FAILED | ${body.message ?? resp.status}`);
    throw new Error(`MSG91 error: ${body.message ?? resp.status}`);
  }

  console.log(`[MSG91] OTP sent successfully to ${mobile}`);

  if (body.otp) {
    console.log(`[MSG91] OTP returned in response — storing in local DB`);
    await clearExpiredOtps(phone);
    await createOtpRecord(phone, body.otp);
    console.log(`[MSG91] OTP stored in DB for ${phone}`);
  } else {
    console.log(`[MSG91] OTP not returned in response — skipping local DB store`);
  }
}

export async function verifyOtpWithMsg91(phone: string, otp: string): Promise<OtpValidationResult> {
  const mobile = toMobile(phone);
  console.log(`[MSG91] verifyOtp called | mobile=${mobile} | otp=${otp}`);

  const url = new URL('https://control.msg91.com/api/v5/otp/verify');
  url.searchParams.set('mobile', mobile);
  url.searchParams.set('otp', otp);

  const resp = await fetch(url.toString(), {
    headers: { authkey: msg91AuthKey() },
  });

  const body = await resp.json() as { type: string; message: string };
  console.log(`[MSG91] verifyOtp response | status=${resp.status} | body=${JSON.stringify(body)}`);

  if (body.type === 'success') {
    console.log(`[MSG91] OTP verified successfully for ${mobile}`);
    return { valid: true };
  }

  console.warn(`[MSG91] OTP verification FAILED for ${mobile} | reason=${body.message}`);
  return { valid: false, error: body.message ?? 'Invalid OTP', statusCode: 400 };
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
    { expiresIn: config.jwt.accessExpiry as unknown as import('ms').StringValue }
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
