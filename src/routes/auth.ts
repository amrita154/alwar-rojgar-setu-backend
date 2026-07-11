import { Router } from 'express';
import passport from 'passport';
import { register, login, googleCallback, refreshToken, logout } from '../controllers/auth';
import { authenticate } from '../middleware/auth';
import { loginLimiter, registerLimiter } from '../middleware/rateLimiter';

const router = Router();

router.post('/register', registerLimiter, register);
router.post('/login', loginLimiter, login);
router.get('/google', passport.authenticate('google', { scope: ['profile', 'email'] }));
router.get('/google/callback', passport.authenticate('google', { failureRedirect: '/login' }), googleCallback);
router.post('/token/refresh', refreshToken);
router.post('/logout', authenticate, logout);

export default router;
