import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { pool } from '../config/database';
import { config } from '../config';
import { Role, JwtPayload } from '../types';

/**
 * Thrown when a user tries to register with an email that is already taken,
 * or when a Google login conflicts with an existing email/password account.
 * `conflictMethod` indicates which method owns the existing account.
 */
export class AuthMethodConflictError extends Error {
  constructor(public conflictMethod: 'email' | 'google') {
    super(`Email is already registered via ${conflictMethod}`);
    this.name = 'AuthMethodConflictError';
  }
}

function getRefreshExpiry(): Date {
  const d = new Date();
  d.setDate(d.getDate() + 30);
  return d;
}

export interface AuthValidationResult {
  valid: boolean;
  error?: string;
  statusCode?: number;
}

/**
 * Create a verified user account after successful OTP verification.
 * Throws AuthMethodConflictError if the email is already registered.
 */
export async function registerVerifiedUser(
  email: string,
  passwordHash: string,
  role: Role
): Promise<Record<string, unknown>> {
  const existing = await pool.query('SELECT id, google_id, password_hash FROM users WHERE email = $1', [email]);
  if (existing.rows.length > 0) {
    const user = existing.rows[0];
    if (user.google_id && !user.password_hash) {
      throw new AuthMethodConflictError('google');
    }
    throw new AuthMethodConflictError('email');
  }

  const result = await pool.query(
    `INSERT INTO users (email, password_hash, role, is_active, email_verified, admin_status)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [
      email,
      passwordHash,
      role,
      role === 'admin' ? false : true,
      true,
      role === 'admin' ? 'pending' : null,
    ]
  );

  return result.rows[0];
}

export async function loginWithEmailPassword(
  email: string,
  password: string
): Promise<AuthValidationResult> {
  const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);

  if (result.rows.length === 0) {
    return { valid: false, error: 'No account found with this email. Please sign up first.', statusCode: 404 };
  }

  const user = result.rows[0];

  if (!user.password_hash) {
    if (user.google_id) {
      return {
        valid: false,
        error: 'This account was created with Google Sign-In. Please continue with Google.',
        statusCode: 401,
      };
    }
    return { valid: false, error: 'Invalid credentials', statusCode: 401 };
  }

  if (!user.email_verified) {
    return {
      valid: false,
      error: 'Please verify your email before logging in.',
      statusCode: 403,
    };
  }

  if (!user.is_active) {
    if (user.admin_status === 'pending') {
      return { valid: false, error: 'Your admin account is awaiting approval. An existing admin must approve it before you can log in.', statusCode: 403 };
    }
    if (user.admin_status === 'rejected') {
      return { valid: false, error: 'Your admin account application was rejected. Contact support for assistance.', statusCode: 403 };
    }
    return { valid: false, error: 'Account is disabled. Contact support.', statusCode: 403 };
  }

  const isValid = await bcrypt.compare(password, user.password_hash);
  if (!isValid) {
    return { valid: false, error: 'Invalid credentials', statusCode: 401 };
  }

  return { valid: true };
}

/**
 * Find or create a user via Google OAuth.
 *
 * - Existing Google account → return it.
 * - Email exists with password (email/password account) but no google_id
 *   → throw AuthMethodConflictError('email') — do NOT silently link.
 * - No existing account → create a new one (email_verified = true, Google verifies emails).
 */
export async function findOrCreateUserByGoogle(
  googleId: string,
  email: string,
  name?: string
): Promise<Record<string, unknown>> {
  const byGoogleId = await pool.query('SELECT * FROM users WHERE google_id = $1', [googleId]);
  if (byGoogleId.rows.length > 0) {
    return byGoogleId.rows[0];
  }

  const byEmail = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
  if (byEmail.rows.length > 0) {
    const existing = byEmail.rows[0];
    if (existing.password_hash && !existing.google_id) {
      throw new AuthMethodConflictError('email');
    }
    if (!existing.google_id) {
      await pool.query(
        'UPDATE users SET google_id = $1, name = $2, email_verified = true WHERE id = $3',
        [googleId, name ?? existing.name, existing.id]
      );
    }
    return { ...existing, google_id: googleId, email_verified: true };
  }

  const result = await pool.query(
    `INSERT INTO users (email, google_id, role, is_active, email_verified, name)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [email, googleId, 'candidate', true, true, name ?? null]
  );
  return result.rows[0];
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

/**
 * Look up a user by email and return their id + current auth method.
 * Used by forgot-password to validate the email before sending a reset OTP.
 */
export async function getUserByEmail(email: string): Promise<{ id: string; hasPassword: boolean; googleOnly: boolean } | null> {
  const result = await pool.query('SELECT id, password_hash, google_id FROM users WHERE email = $1 AND is_active = true', [email]);
  if (result.rows.length === 0) return null;
  const row = result.rows[0];
  return {
    id: row.id,
    hasPassword: !!row.password_hash,
    googleOnly: !row.password_hash && !!row.google_id,
  };
}

/**
 * Set a new password for a user after OTP verification.
 */
export async function resetPassword(email: string, newPassword: string): Promise<void> {
  const passwordHash = await bcrypt.hash(newPassword, 12);
  const result = await pool.query(
    'UPDATE users SET password_hash = $1, updated_at = NOW() WHERE email = $2 RETURNING id',
    [passwordHash, email]
  );
  if (result.rows.length === 0) {
    throw Object.assign(new Error('User not found'), { statusCode: 404 });
  }
}
