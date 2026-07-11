import { Request, Response } from 'express';
import { config } from '../config';
import { AuthRequest } from '../middleware/auth';
import * as authService from '../services/auth';
import * as adminService from '../services/admin';
import { Role } from '../types';

export async function requestOtp(req: Request, res: Response): Promise<void> {
  const { phone, role } = req.body;
  console.log(`[AUTH] requestOtp | phone=${phone} | role=${role}`);

  if (!phone || typeof phone !== 'string') {
    res.status(400).json({ message: 'Phone number is required' });
    return;
  }

  try {
    await authService.sendOtp(phone);
  } catch (err) {
    console.error('[AUTH] requestOtp FAILED:', err);
    res.status(502).json({ message: 'Failed to send OTP. Please try again.' });
    return;
  }

  console.log(`[AUTH] requestOtp SUCCESS | phone=${phone}`);
  res.status(200).json({ message: 'OTP sent successfully' });
}

export async function verifyOtp(req: Request, res: Response): Promise<void> {
  const { phone, otp, role } = req.body;

  if (!phone || !otp) {
    res.status(400).json({ message: 'Phone and OTP are required' });
    return;
  }

  console.log(`[AUTH] verifyOtp | phone=${phone} | role=${role} | provider=${config.otp.smsProvider}`);

  const isMSG91 = config.otp.smsProvider === 'msg91';
  const validation = isMSG91
    ? await authService.verifyOtpWithMsg91(phone, otp)
    : await authService.validateOtp(phone, otp);

  if (!validation.valid) {
    console.warn(`[AUTH] verifyOtp FAILED | phone=${phone} | reason=${validation.error}`);
    res.status(validation.statusCode!).json({ message: validation.error });
    return;
  }

  // Clean up local record on successful MSG91 verify
  if (isMSG91) {
    await authService.clearExpiredOtps(phone);
    console.log(`[AUTH] Cleared local OTP record for ${phone}`);
  }

  console.log(`[AUTH] OTP verified | finding/creating user | phone=${phone} | role=${role}`);
  const { user } = await authService.findOrCreateUser(phone, role);
  console.log(`[AUTH] User resolved | userId=${user.id} | role=${user.role} | isActive=${user.is_active}`);

  if (!user.is_active) {
    console.warn(`[AUTH] Login blocked — account disabled | userId=${user.id}`);
    res.status(403).json({ message: 'Account is disabled. Contact support.' });
    return;
  }

  const accessToken = authService.generateAccessToken(user.id as string, user.role as Role);
  const refreshToken = await authService.generateAndStoreRefreshToken(user.id as string);
  console.log(`[AUTH] Login SUCCESS | userId=${user.id} | role=${user.role}`);

  res.cookie('refreshToken', refreshToken, {
    httpOnly: true,
    secure: config.nodeEnv === 'production',
    sameSite: 'strict',
    maxAge: 30 * 24 * 60 * 60 * 1000,
    path: '/',
  });

  res.status(200).json({ accessToken });
}

function setRefreshCookie(res: Response, refreshToken: string): void {
  res.cookie('refreshToken', refreshToken, {
    httpOnly: true,
    secure: config.nodeEnv === 'production',
    sameSite: 'strict',
    maxAge: 30 * 24 * 60 * 60 * 1000,
    path: '/',
  });
}

export async function register(req: Request, res: Response): Promise<void> {
  const { email, password, role, adminInviteCode } = req.body;

  if (!email || typeof email !== 'string' || !password || typeof password !== 'string') {
    res.status(400).json({ message: 'Email and password are required' });
    return;
  }

  try {
    const user = await authService.registerWithEmail(email, password, role, adminInviteCode);
    const accessToken = authService.generateAccessToken(user.id as string, user.role as Role);
    const refresh = await authService.generateAndStoreRefreshToken(user.id as string);
    console.log(`[AUTH] Register SUCCESS | userId=${user.id} | role=${user.role}`);
    setRefreshCookie(res, refresh);
    res.status(201).json({ accessToken });
  } catch (err: unknown) {
    const statusCode = (err as { statusCode?: number }).statusCode;
    if (statusCode) {
      res.status(statusCode).json({ message: (err as Error).message });
      return;
    }
    console.error('[AUTH] Register FAILED:', err);
    res.status(500).json({ message: 'Registration failed. Please try again.' });
  }
}

export async function login(req: Request, res: Response): Promise<void> {
  const { email, password } = req.body;

  if (!email || typeof email !== 'string' || !password || typeof password !== 'string') {
    res.status(400).json({ message: 'Email and password are required' });
    return;
  }

  const user = await authService.loginWithEmail(email, password);
  if (!user) {
    console.warn(`[AUTH] Login FAILED | invalid credentials`);
    res.status(401).json({ message: 'Invalid email or password' });
    return;
  }

  if (!user.is_active) {
    console.warn(`[AUTH] Login blocked — account disabled | userId=${user.id}`);
    res.status(403).json({ message: 'Account is disabled. Contact support.' });
    return;
  }

  const accessToken = authService.generateAccessToken(user.id as string, user.role as Role);
  const refresh = await authService.generateAndStoreRefreshToken(user.id as string);
  console.log(`[AUTH] Login SUCCESS | userId=${user.id} | role=${user.role}`);
  setRefreshCookie(res, refresh);
  res.status(200).json({ accessToken });
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

export async function requestAdminAccess(req: Request, res: Response): Promise<void> {
  const { name, phone } = req.body;

  if (!name || typeof name !== 'string' || !phone || typeof phone !== 'string') {
    res.status(400).json({ message: 'Name and phone are required' });
    return;
  }

  try {
    const user = await adminService.createAdminRequest(name.trim(), phone.trim());
    console.log(`[AUTH] Admin request created | phone=${phone} | name=${name}`);
    res.status(201).json(user);
  } catch (err: unknown) {
    const statusCode = (err as { statusCode?: number }).statusCode;
    if (statusCode === 400 || statusCode === 409) {
      res.status(statusCode).json({ message: (err as Error).message });
      return;
    }
    throw err;
  }
}

export async function logout(req: AuthRequest, res: Response): Promise<void> {
  if (req.user) {
    await authService.revokeRefreshToken(req.user.userId);
  }
  res.clearCookie('refreshToken', { path: '/' });
  res.status(200).json({ message: 'Logged out successfully' });
}
