import { Request, Response } from 'express';
import { config } from '../config';
import { AuthRequest } from '../middleware/auth';
import * as authService from '../services/auth';
import { Role } from '../types';

export async function requestOtp(req: Request, res: Response): Promise<void> {
  const { phone, role } = req.body;

  if (!phone || typeof phone !== 'string') {
    res.status(400).json({ message: 'Phone number is required' });
    return;
  }

  await authService.clearExpiredOtps(phone);
  const otp = authService.generateOtp(phone);
  await authService.createOtpRecord(phone, otp);
  await authService.sendOtp(phone, otp);

  res.status(200).json({ message: 'OTP sent successfully' });
}

export async function verifyOtp(req: Request, res: Response): Promise<void> {
  const { phone, otp, role } = req.body;

  if (!phone || !otp) {
    res.status(400).json({ message: 'Phone and OTP are required' });
    return;
  }

  const validation = await authService.validateOtp(phone, otp);
  if (!validation.valid) {
    res.status(validation.statusCode!).json({ message: validation.error });
    return;
  }

  const { user } = await authService.findOrCreateUser(phone, role);

  if (!user.is_active) {
    res.status(403).json({ message: 'Account is disabled. Contact support.' });
    return;
  }

  const accessToken = authService.generateAccessToken(user.id as string, user.role as Role);
  const refreshToken = await authService.generateAndStoreRefreshToken(user.id as string);

  res.cookie('refreshToken', refreshToken, {
    httpOnly: true,
    secure: config.nodeEnv === 'production',
    sameSite: 'strict',
    maxAge: 30 * 24 * 60 * 60 * 1000,
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
