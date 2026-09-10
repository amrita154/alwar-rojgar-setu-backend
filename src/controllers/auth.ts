import crypto from 'crypto';
import bcrypt from 'bcrypt';
import { Request, Response } from 'express';
import { config } from '../config';
import { AuthRequest } from '../middleware/auth';
import * as authService from '../services/auth';
import { AuthMethodConflictError } from '../services/auth';
import * as otpService from '../services/otp';
import { OtpDailyLimitError } from '../services/otp';
import { Role } from '../types';

const BCRYPT_ROUNDS = 12;

function setCookieAndRespond(
  res: Response,
  accessToken: string,
  refreshToken: string,
  statusCode = 200
): void {
  res.cookie('refreshToken', refreshToken, {
    httpOnly: true,
    secure: config.nodeEnv === 'production',
    sameSite: 'strict',
    maxAge: 30 * 24 * 60 * 60 * 1000,
    path: '/',
  });
  res.status(statusCode).json({ accessToken });
}

/**
 * POST /auth/send-otp
 *
 * Step 1 of email registration.
 * Validates inputs, checks email availability, then sends a 6-digit OTP.
 * Does NOT create the user account yet.
 */
export async function sendOtp(req: Request, res: Response): Promise<void> {
  const { email, password, role } = req.body;

  if (!email || typeof email !== 'string') {
    res.status(400).json({ message: 'Email is required' });
    return;
  }
  if (!password || typeof password !== 'string') {
    res.status(400).json({ message: 'Password is required' });
    return;
  }
  if (password.length < 8) {
    res.status(400).json({ message: 'Password must be at least 8 characters long' });
    return;
  }

  // Admin is no longer a self-serve signup option — it's only ever granted by
  // an existing admin (see grantAdminAccess) or the bootstrap super-admin
  // whitelist, both of which transparently override this at registerVerifiedUser time.
  const validRoles: Role[] = ['candidate', 'employer'];
  if (!role || !validRoles.includes(role)) {
    res.status(400).json({ message: 'Invalid role' });
    return;
  }

  const normalizedEmail = email.toLowerCase().trim();

  try {
    const { pool } = await import('../config/database');
    const existing = await pool.query(
      'SELECT google_id, password_hash FROM users WHERE email = $1',
      [normalizedEmail]
    );

    if (existing.rows.length > 0) {
      const user = existing.rows[0];
      if (user.google_id && !user.password_hash) {
        res.status(409).json({
          message: 'This account was created with Google Sign-In. Please continue with Google.',
          conflictMethod: 'google',
        });
      } else {
        res.status(409).json({
          message: 'This email is already registered. Please log in.',
          conflictMethod: 'email',
        });
      }
      return;
    }

    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    await otpService.generateAndSendOtp(normalizedEmail, passwordHash, role as Role);

    res.status(200).json({ message: 'Verification code sent to your email. It expires in 10 minutes.' });
  } catch (err) {
    if (err instanceof OtpDailyLimitError) {
      res.status(429).json({ message: 'Too many codes requested. Please try again after 24 hours.' });
      return;
    }
    console.error('[AUTH] Send OTP FAILED:', err);
    res.status(500).json({ message: 'Failed to send verification code. Please try again.' });
  }
}

/**
 * POST /auth/verify-otp
 *
 * Step 2 of email registration.
 * Verifies the OTP, creates the account, and issues tokens — all in one transaction.
 */
export async function verifyOtpAndRegister(req: Request, res: Response): Promise<void> {
  const { email, otp } = req.body;

  if (!email || typeof email !== 'string') {
    res.status(400).json({ message: 'Email is required' });
    return;
  }
  if (!otp || typeof otp !== 'string' || !/^\d{6}$/.test(otp)) {
    res.status(400).json({ message: 'A valid 6-digit verification code is required' });
    return;
  }

  const normalizedEmail = email.toLowerCase().trim();

  try {
    const verifyResult = await otpService.verifyOtp(normalizedEmail, otp);
    if (!verifyResult.valid) {
      res.status(verifyResult.statusCode!).json({ message: verifyResult.error });
      return;
    }

    const pending = await otpService.getPendingRegistration(normalizedEmail);
    if (!pending) {
      res.status(400).json({ message: 'Verification session expired. Please start over.' });
      return;
    }

    const user = await authService.registerVerifiedUser(
      normalizedEmail,
      pending.passwordHash,
      pending.role
    );


    const accessToken = authService.generateAccessToken(user.id as string, user.role as Role);
    const refreshToken = await authService.generateAndStoreRefreshToken(user.id as string);

    setCookieAndRespond(res, accessToken, refreshToken, 201);
  } catch (err) {
    if (err instanceof AuthMethodConflictError) {
      const isGoogle = err.conflictMethod === 'google';
      res.status(409).json({
        message: isGoogle
          ? 'This account was created with Google Sign-In. Please continue with Google.'
          : 'This email is already registered. Please log in.',
        conflictMethod: err.conflictMethod,
      });
      return;
    }
    if ((err as Error).message.includes('invite code')) {
      res.status(401).json({ message: 'Invalid admin invite code' });
      return;
    }
    console.error('[AUTH] Verify OTP FAILED:', err);
    res.status(500).json({ message: 'Registration failed. Please try again.' });
  }
}

export async function login(req: Request, res: Response): Promise<void> {
  const { email, password } = req.body;

  if (!email || typeof email !== 'string' || !password || typeof password !== 'string') {
    res.status(400).json({ message: 'Email and password are required' });
    return;
  }

  try {
    const validation = await authService.loginWithEmailPassword(email.toLowerCase().trim(), password);

    if (!validation.valid) {
      console.warn(`[AUTH] Login FAILED | email=${email} | reason=${validation.error}`);
      res.status(validation.statusCode!).json({ message: validation.error });
      return;
    }

    const { pool } = await import('../config/database');
    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email.toLowerCase().trim()]);
    const userResult = result.rows[0];

    const accessToken = authService.generateAccessToken(userResult.id as string, userResult.role as Role);
    const refreshToken = await authService.generateAndStoreRefreshToken(userResult.id as string);


    setCookieAndRespond(res, accessToken, refreshToken);
  } catch (err) {
    console.error('[AUTH] Login FAILED:', err);
    res.status(500).json({ message: 'Login failed' });
  }
}

export async function googleCallback(req: AuthRequest, res: Response): Promise<void> {
  if (!req.user) {
    res.redirect(`${config.frontend.url}/auth/google/callback?status=error`);
    return;
  }

  const result = req.user as unknown as authService.GoogleAuthResult;

  if (result.status === 'new_role_required') {
    // Brand-new Google account — we don't know if they're a job seeker or an
    // employer, so hand off to the frontend to ask, instead of guessing.
    const pendingToken = authService.generatePendingGoogleToken({
      googleId: result.googleId,
      email: result.email,
      name: result.name,
    });
    res.redirect(
      `${config.frontend.url}/auth/google/callback?status=needs-role&pendingToken=${encodeURIComponent(pendingToken)}`
    );
    return;
  }

  const user = result.user;

  if (!user.is_active) {
    if (user.admin_status === 'pending') {
      console.warn(`[AUTH] Login blocked — admin pending approval | userId=${user.id}`);
      res.redirect(`${config.frontend.url}/auth/google/callback?status=pending`);
    } else if (user.admin_status === 'rejected') {
      console.warn(`[AUTH] Login blocked — admin rejected | userId=${user.id}`);
      res.redirect(`${config.frontend.url}/auth/google/callback?status=rejected`);
    } else {
      console.warn(`[AUTH] Login blocked — account disabled | userId=${user.id}`);
      res.redirect(`${config.frontend.url}/auth/google/callback?status=disabled`);
    }
    return;
  }

  try {
    const accessToken = authService.generateAccessToken(user.id as string, user.role as Role);
    const refreshToken = await authService.generateAndStoreRefreshToken(user.id as string);


    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: config.nodeEnv === 'production',
      sameSite: 'strict',
      maxAge: 30 * 24 * 60 * 60 * 1000,
      path: '/',
    });

    res.redirect(`${config.frontend.url}/auth/google/callback?status=success&token=${accessToken}`);
  } catch (err) {
    console.error('[AUTH] Google callback FAILED:', err);
    res.redirect(`${config.frontend.url}/auth/google/callback?status=error`);
  }
}

/**
 * POST /auth/google/complete
 *
 * Second step of Google sign-up for brand-new accounts: the frontend showed
 * a "job seeker or employer?" prompt after /auth/google/callback redirected
 * with status=needs-role, and now submits the chosen role plus the signed
 * pendingToken (which carries the Google identity — never a client-supplied
 * googleId/email) to actually create the account.
 */
export async function completeGoogleSignup(req: Request, res: Response): Promise<void> {
  const { pendingToken, role } = req.body;

  if (!pendingToken || typeof pendingToken !== 'string') {
    res.status(400).json({ message: 'Missing or invalid registration token' });
    return;
  }
  // Admin is never offered on this screen — a brand-new signup whose email
  // was pre-granted admin access is created as admin further upstream (see
  // findOrCreateUserByGoogle) and never reaches status=needs-role at all.
  if (role !== 'candidate' && role !== 'employer') {
    res.status(400).json({ message: 'Role must be candidate or employer' });
    return;
  }

  try {
    const pending = authService.verifyPendingGoogleToken(pendingToken);
    const user = await authService.createGoogleUserWithRole(pending, role);


    const accessToken = authService.generateAccessToken(user.id as string, user.role as Role);
    const refreshToken = await authService.generateAndStoreRefreshToken(user.id as string);

    setCookieAndRespond(res, accessToken, refreshToken, 201);
  } catch (err) {
    if (err instanceof AuthMethodConflictError) {
      res.status(409).json({
        message: 'This email is already registered. Please log in.',
        conflictMethod: err.conflictMethod,
      });
      return;
    }
    console.error('[AUTH] Google signup completion FAILED:', err);
    res.status(400).json({ message: 'Registration link expired or invalid. Please try Google sign-in again.' });
  }
}

export async function refreshToken(req: Request, res: Response): Promise<void> {
  const token = req.cookies?.refreshToken;

  if (!token) {
    res.status(401).json({ message: 'Refresh token required' });
    return;
  }

  const user = await authService.validateRefreshToken(token);
  if (!user) {
    res.status(401).json({ message: 'Invalid or expired refresh token' });
    return;
  }

  if (!user.is_active) {
    if (user.admin_status === 'pending') {
      res.status(403).json({ message: 'Your admin account is awaiting approval.' });
    } else if (user.admin_status === 'rejected') {
      res.status(403).json({ message: 'Your admin account application was rejected.' });
    } else {
      res.status(403).json({ message: 'Account is disabled' });
    }
    return;
  }

  const accessToken = authService.generateAccessToken(user.id as string, user.role as Role);
  const newRefreshToken = await authService.generateAndStoreRefreshToken(user.id as string);

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
    await authService.revokeRefreshToken(req.user.userId);
  }
  res.clearCookie('refreshToken', { path: '/' });
  res.status(200).json({ message: 'Logged out successfully' });
}

/**
 * POST /auth/forgot-password
 * Sends a password-reset OTP to the given email.
 * Always returns 200 — never reveals whether the email exists (anti-enumeration).
 */
export async function forgotPassword(req: Request, res: Response): Promise<void> {
  try {
    const { email } = req.body as { email?: string };
    if (!email || typeof email !== 'string') {
      res.status(400).json({ message: 'Email is required' });
      return;
    }

    const user = await authService.getUserByEmail(email.toLowerCase().trim());

    if (!user) {
      // Anti-enumeration: don't reveal missing email
      res.status(200).json({ message: 'If that email is registered, a reset code has been sent.' });
      return;
    }

    if (user.googleOnly) {
      res.status(400).json({
        message: 'This account uses Google Sign-In. Please sign in with Google instead.',
      });
      return;
    }

    await otpService.generateAndSendResetOtp(email.toLowerCase().trim());
    res.status(200).json({ message: 'If that email is registered, a reset code has been sent.' });
  } catch (err) {
    if (err instanceof OtpDailyLimitError) {
      res.status(429).json({ message: 'Too many reset attempts. Please try again tomorrow.' });
      return;
    }
    console.error('[AUTH] forgotPassword error:', err);
    res.status(500).json({ message: 'Internal error' });
  }
}

/**
 * POST /auth/reset-password
 * Verifies the OTP and sets the new password.
 */
export async function resetPassword(req: Request, res: Response): Promise<void> {
  try {
    const { email, otp, newPassword } = req.body as {
      email?: string;
      otp?: string;
      newPassword?: string;
    };

    if (!email || !otp || !newPassword) {
      res.status(400).json({ message: 'Email, OTP, and new password are required' });
      return;
    }

    if (newPassword.length < 8) {
      res.status(400).json({ message: 'Password must be at least 8 characters' });
      return;
    }

    const normalizedEmail = email.toLowerCase().trim();
    const result = await otpService.verifyResetOtp(normalizedEmail, otp);

    if (!result.valid) {
      res.status(result.statusCode ?? 400).json({ message: result.error });
      return;
    }

    await authService.resetPassword(normalizedEmail, newPassword);
    res.status(200).json({ message: 'Password reset successfully. You can now log in.' });
  } catch (err) {
    console.error('[AUTH] resetPassword error:', err);
    res.status(500).json({ message: 'Internal error' });
  }
}
