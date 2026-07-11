import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { pool } from '../config/database';
import { config } from '../config';
import { Role, JwtPayload } from '../types';

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

export async function registerWithEmailPassword(
  email: string,
  password: string,
  role: Role,
  adminInviteCode?: string
): Promise<Record<string, unknown>> {
  const passwordHash = await bcrypt.hash(password, 12);
  
  if (role === 'admin' && config.admin.inviteCode !== adminInviteCode) {
    throw new Error('Invalid admin invite code');
  }

  const result = await pool.query(
    `INSERT INTO users (email, password_hash, role, is_active, admin_status)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (email) DO UPDATE SET password_hash = $2
     RETURNING *`,
    [email, passwordHash, role, role === 'admin' ? false : true, role === 'admin' ? 'pending' : null]
  );
  
  return result.rows[0];
}

export async function loginWithEmailPassword(
  email: string,
  password: string
): Promise<AuthValidationResult> {
  const result = await pool.query(
    'SELECT * FROM users WHERE email = $1',
    [email]
  );

  if (result.rows.length === 0) {
    return { valid: false, error: 'Invalid credentials', statusCode: 401 };
  }

  const user = result.rows[0];

  if (!user.password_hash) {
    return { valid: false, error: 'Invalid credentials', statusCode: 401 };
  }

  if (!user.is_active) {
    return { valid: false, error: 'Account is disabled. Contact support.', statusCode: 403 };
  }

  const isValid = await bcrypt.compare(password, user.password_hash);
  if (!isValid) {
    return { valid: false, error: 'Invalid credentials', statusCode: 401 };
  }

  return { valid: true };
}

export async function findOrCreateUserByGoogle(
  googleId: string,
  email: string,
  name?: string
): Promise<Record<string, unknown>> {
  let result = await pool.query('SELECT * FROM users WHERE google_id = $1 OR email = $2', [googleId, email]);

  if (result.rows.length === 0) {
    result = await pool.query(
      `INSERT INTO users (email, google_id, role, is_active, name)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [email, googleId, 'candidate', true, name || null]
    );
    return result.rows[0];
  }

  const user = result.rows[0];
  
  if (!user.google_id) {
    await pool.query('UPDATE users SET google_id = $1, name = $2 WHERE id = $3', [googleId, name || user.name, user.id]);
  }

  return user;
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
