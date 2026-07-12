import rateLimit from 'express-rate-limit';
import type { Request } from 'express';
import { config } from '../config';

function getClientIp(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') {
    return forwarded.split(',')[0].trim();
  }
  return req.socket.remoteAddress || 'unknown';
}

export const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many requests. Try again later.' },
});

// Per-IP: stops one machine brute-forcing across many accounts (generous to handle shared NAT).
export const loginIpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many requests from your network. Try again in 15 minutes.' },
  keyGenerator: getClientIp,
});

// Per-email: stops credential stuffing against one account regardless of attacker IP count.
export const loginEmailLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many login attempts for this account. Try again in 15 minutes.' },
  keyGenerator: (req: Request) => `email:${(req.body?.email as string | undefined)?.toLowerCase() ?? 'unknown'}`,
  skip: (req: Request) => !req.body?.email,
});

export const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many registration attempts. Try again later.' },
  keyGenerator: getClientIp,
  skip: (req: Request) => !req.body?.email,
});

export const otpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many verification attempts. Try again in 15 minutes.' },
  keyGenerator: getClientIp,
});

export const translationLimiter = rateLimit({
  windowMs: config.translation.rateLimit.windowMs,
  max: config.translation.rateLimit.max,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many translation requests. Please slow down.' },
});
