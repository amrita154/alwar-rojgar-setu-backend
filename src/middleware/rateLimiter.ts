import rateLimit from 'express-rate-limit';
import { config } from '../config';

export const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many requests. Try again later.' },
});

export const otpPhoneLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 3,
  keyGenerator: (req) => req.body?.phone ?? req.ip ?? 'unknown',
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many OTP requests for this number. Try again in 10 minutes.' },
});

export const otpIpLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many requests from this device. Try again later.' },
});

export const translationLimiter = rateLimit({
  windowMs: config.translation.rateLimit.windowMs,
  max: config.translation.rateLimit.max,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many translation requests. Please slow down.' },
});
