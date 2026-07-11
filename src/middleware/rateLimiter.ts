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

export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many login attempts. Try again in 15 minutes.' },
  keyGenerator: getClientIp,
});

export const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many registration attempts. Try again later.' },
  keyGenerator: getClientIp,
});

export const translationLimiter = rateLimit({
  windowMs: config.translation.rateLimit.windowMs,
  max: config.translation.rateLimit.max,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many translation requests. Please slow down.' },
});
