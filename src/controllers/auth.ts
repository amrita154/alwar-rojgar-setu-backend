import { Request, Response } from 'express';
import { config } from '../config';
import { AuthRequest } from '../middleware/auth';
import * as authService from '../services/auth';
import { Role } from '../types';

export async function register(req: Request, res: Response): Promise<void> {
  const { email, password, role, adminInviteCode } = req.body;

  if (!email || typeof email !== 'string' || !password || typeof password !== 'string' || !role) {
    res.status(400).json({ message: 'Email, password, and role are required' });
    return;
  }

  if (password.length < 8) {
    res.status(400).json({ message: 'Password must be at least 8 characters long' });
    return;
  }

  const validRoles: Role[] = ['candidate', 'employer', 'admin'];
  if (!validRoles.includes(role)) {
    res.status(400).json({ message: 'Invalid role' });
    return;
  }

  try {
    const user = await authService.registerWithEmailPassword(email.toLowerCase(), password, role, adminInviteCode);
    console.log(`[AUTH] User registered | email=${email} | role=${role} | userId=${user.id}`);

    const accessToken = authService.generateAccessToken(user.id as string, user.role as Role);
    const refreshToken = await authService.generateAndStoreRefreshToken(user.id as string);

    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: config.nodeEnv === 'production',
      sameSite: 'strict',
      maxAge: 30 * 24 * 60 * 60 * 1000,
      path: '/',
    });

    res.status(201).json({ accessToken });
  } catch (err) {
    console.error('[AUTH] Register FAILED:', err);
    if ((err as Error).message.includes('invite code')) {
      res.status(401).json({ message: 'Invalid admin invite code' });
      return;
    }
    res.status(500).json({ message: 'Registration failed' });
  }
}

export async function login(req: Request, res: Response): Promise<void> {
  const { email, password } = req.body;

  if (!email || typeof email !== 'string' || !password || typeof password !== 'string') {
    res.status(400).json({ message: 'Email and password are required' });
    return;
  }

  try {
    const validation = await authService.loginWithEmailPassword(email.toLowerCase(), password);

    if (!validation.valid) {
      console.warn(`[AUTH] Login FAILED | email=${email} | reason=${validation.error}`);
      res.status(validation.statusCode!).json({ message: validation.error });
      return;
    }

    const { pool } = await import('../config/database');
    const result = await pool.query(
      'SELECT * FROM users WHERE email = $1',
      [email.toLowerCase()]
    );
    const userResult = result.rows[0];

    const accessToken = authService.generateAccessToken(userResult.id as string, userResult.role as Role);
    const refreshToken = await authService.generateAndStoreRefreshToken(userResult.id as string);

    console.log(`[AUTH] Login SUCCESS | email=${email} | userId=${userResult.id} | role=${userResult.role}`);

    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: config.nodeEnv === 'production',
      sameSite: 'strict',
      maxAge: 30 * 24 * 60 * 60 * 1000,
      path: '/',
    });

    res.status(200).json({ accessToken });
  } catch (err) {
    console.error('[AUTH] Login FAILED:', err);
    res.status(500).json({ message: 'Login failed' });
  }
}

export async function googleCallback(req: AuthRequest, res: Response): Promise<void> {
  if (!req.user) {
    res.status(401).json({ message: 'Authentication failed' });
    return;
  }

  const user = req.user as Record<string, unknown>;

  if (!user.is_active) {
    console.warn(`[AUTH] Login blocked — account disabled | userId=${user.id}`);
    res.redirect(`${config.frontend.url}/auth/google/callback?status=disabled`);
    return;
  }

  try {
    const accessToken = authService.generateAccessToken(user.id as string, user.role as Role);
    const refreshToken = await authService.generateAndStoreRefreshToken(user.id as string);

    console.log(`[AUTH] Google login SUCCESS | userId=${user.id} | email=${user.email}`);

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
    res.status(403).json({ message: 'Account is disabled' });
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
