import { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { pool } from '../config/database';
import { config } from '../config';
import { AuthRequest } from '../middleware/auth';
import { Role } from '../types';

function generateOtp(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

function getRefreshExpiry(): Date {
  const d = new Date();
  d.setDate(d.getDate() + 30);
  return d;
}

export async function requestOtp(req: Request, res: Response): Promise<void> {
  const { phone, role } = req.body;

  if (!phone || typeof phone !== 'string') {
    res.status(400).json({ message: 'Phone number is required' });
    return;
  }

  // Clean expired OTPs for this phone
  await pool.query('DELETE FROM otp_verification WHERE phone = $1', [phone]);

  const otp = generateOtp();
  const otpHash = await bcrypt.hash(otp, 10);
  const expiresAt = new Date(Date.now() + config.otp.expiryMinutes * 60 * 1000);

  await pool.query(
    'INSERT INTO otp_verification (phone, otp_hash, expires_at) VALUES ($1, $2, $3)',
    [phone, otpHash, expiresAt]
  );

  // In dev mode, log OTP to console
  if (config.otp.smsProvider === 'console') {
    console.log(`[DEV OTP] Phone: ${phone}, OTP: ${otp}`);
  }

  res.status(200).json({ message: 'OTP sent successfully' });
}

export async function verifyOtp(req: Request, res: Response): Promise<void> {
  const { phone, otp } = req.body;

  if (!phone || !otp) {
    res.status(400).json({ message: 'Phone and OTP are required' });
    return;
  }

  const otpResult = await pool.query(
    'SELECT * FROM otp_verification WHERE phone = $1 ORDER BY created_at DESC LIMIT 1',
    [phone]
  );

  if (otpResult.rows.length === 0) {
    res.status(400).json({ message: 'No OTP found. Please request a new one.' });
    return;
  }

  const otpRecord = otpResult.rows[0];

  if (new Date() > new Date(otpRecord.expires_at)) {
    await pool.query('DELETE FROM otp_verification WHERE id = $1', [otpRecord.id]);
    res.status(400).json({ message: 'OTP has expired. Please request a new one.' });
    return;
  }

  if (otpRecord.attempt_count >= config.otp.maxAttempts) {
    await pool.query('DELETE FROM otp_verification WHERE id = $1', [otpRecord.id]);
    res.status(429).json({ message: 'Too many attempts. Please request a new OTP.' });
    return;
  }

  const isValid = await bcrypt.compare(otp, otpRecord.otp_hash);
  if (!isValid) {
    await pool.query(
      'UPDATE otp_verification SET attempt_count = attempt_count + 1 WHERE id = $1',
      [otpRecord.id]
    );
    res.status(400).json({ message: 'Invalid OTP' });
    return;
  }

  // OTP verified — delete it
  await pool.query('DELETE FROM otp_verification WHERE phone = $1', [phone]);

  // Find or create user
  let userResult = await pool.query('SELECT * FROM users WHERE phone = $1', [phone]);

  if (userResult.rows.length === 0) {
    const role: Role = req.body.role || 'candidate';
    const validRoles: Role[] = ['candidate', 'employer'];
    const assignedRole = validRoles.includes(role) ? role : 'candidate';

    userResult = await pool.query(
      'INSERT INTO users (phone, role) VALUES ($1, $2) RETURNING *',
      [phone, assignedRole]
    );
  }

  const user = userResult.rows[0];

  if (!user.is_active) {
    res.status(403).json({ message: 'Account is disabled. Contact support.' });
    return;
  }

  // Generate tokens
  const accessToken = jwt.sign(
    { userId: user.id, role: user.role },
    config.jwt.secret,
    { expiresIn: config.jwt.accessExpiry }
  );

  const refreshToken = uuidv4();
  const refreshExpiry = getRefreshExpiry();

  await pool.query(
    'UPDATE users SET refresh_token = $1, refresh_token_expiry = $2 WHERE id = $3',
    [refreshToken, refreshExpiry, user.id]
  );

  // Set refresh token as httpOnly cookie
  res.cookie('refreshToken', refreshToken, {
    httpOnly: true,
    secure: config.nodeEnv === 'production',
    sameSite: 'strict',
    maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
    path: '/',
  });

  res.status(200).json({ accessToken });
}

export async function refreshToken(req: Request, res: Response): Promise<void> {
  const token = req.cookies?.refreshToken;

  if (!token) {
    res.status(401).json({ message: 'Refresh token required' });
    return;
  }

  const result = await pool.query(
    'SELECT * FROM users WHERE refresh_token = $1 AND refresh_token_expiry > NOW()',
    [token]
  );

  if (result.rows.length === 0) {
    res.status(401).json({ message: 'Invalid or expired refresh token' });
    return;
  }

  const user = result.rows[0];

  if (!user.is_active) {
    res.status(403).json({ message: 'Account is disabled' });
    return;
  }

  const accessToken = jwt.sign(
    { userId: user.id, role: user.role },
    config.jwt.secret,
    { expiresIn: config.jwt.accessExpiry }
  );

  // Rotate refresh token
  const newRefreshToken = uuidv4();
  const refreshExpiry = getRefreshExpiry();

  await pool.query(
    'UPDATE users SET refresh_token = $1, refresh_token_expiry = $2 WHERE id = $3',
    [newRefreshToken, refreshExpiry, user.id]
  );

  res.cookie('refreshToken', newRefreshToken, {
    httpOnly: true,
    secure: config.nodeEnv === 'production',
    sameSite: 'strict',
    maxAge: 30 * 24 * 60 * 60 * 1000,
    path: '/',
  });

  res.status(200).json({ accessToken });
}

export async function logout(req: AuthRequest, res: Response): Promise<void> {
  if (req.user) {
    await pool.query(
      'UPDATE users SET refresh_token = NULL, refresh_token_expiry = NULL WHERE id = $1',
      [req.user.userId]
    );
  }

  res.clearCookie('refreshToken', { path: '/' });
  res.status(200).json({ message: 'Logged out successfully' });
}
