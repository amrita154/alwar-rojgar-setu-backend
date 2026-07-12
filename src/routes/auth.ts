import { Router, Request, Response, NextFunction } from 'express';
import passport from 'passport';
import {
  sendOtp,
  verifyOtpAndRegister,
  login,
  googleCallback,
  refreshToken,
  logout,
  forgotPassword,
  resetPassword,
} from '../controllers/auth';
import { AuthMethodConflictError } from '../services/auth';
import { authenticate } from '../middleware/auth';
import { loginIpLimiter, loginEmailLimiter, registerLimiter, otpLimiter } from '../middleware/rateLimiter';
import { config } from '../config';

const router = Router();

router.post('/send-otp', registerLimiter, sendOtp);
router.post('/verify-otp', otpLimiter, verifyOtpAndRegister);
router.post('/login', loginIpLimiter, loginEmailLimiter, login);

router.get('/google', passport.authenticate('google', { scope: ['profile', 'email'] }));

/**
 * Google OAuth callback.
 *
 * Uses a custom authenticate callback instead of failureRedirect so that we can
 * intercept AuthMethodConflictError (thrown inside the Passport strategy) and
 * redirect to the frontend with the correct status — instead of returning a raw
 * JSON error or a backend /login page.
 */
router.get('/google/callback', (req: Request, res: Response, next: NextFunction) => {
  passport.authenticate(
    'google',
    { session: false },
    (err: Error | null, user: Express.User | false | null) => {
      if (err) {
        if (err instanceof AuthMethodConflictError) {
          return res.redirect(
            `${config.frontend.url}/auth/google/callback?status=conflict&method=${err.conflictMethod}`
          );
        }
        console.error('[AUTH] Google OAuth strategy error:', err);
        return res.redirect(`${config.frontend.url}/auth/google/callback?status=error`);
      }

      if (!user) {
        return res.redirect(`${config.frontend.url}/auth/google/callback?status=error`);
      }

      req.user = user;
      next();
    }
  )(req, res, next);
}, googleCallback);

router.post('/forgot-password', loginIpLimiter, loginEmailLimiter, forgotPassword);
router.post('/reset-password', otpLimiter, resetPassword);

router.post('/token/refresh', refreshToken);
router.post('/logout', authenticate, logout);

export default router;
