import rateLimit from 'express-rate-limit';
import type { Request } from 'express';
import { config } from '../config';

function getClientIp(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  const ip = typeof forwarded === 'string' ? forwarded.split(',')[0].trim() : req.ip;
  return ip || 'unknown';
}

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
  keyGenerator: (req) => {
    const phone = req.body?.phone;
    return typeof phone === 'string' ? phone : getClientIp(req);
  },
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
