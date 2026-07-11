import { Router } from 'express';
import { requestOtp, verifyOtp, register, login, refreshToken, logout, requestAdminAccess } from '../controllers/auth';
import { authenticate } from '../middleware/auth';
import { otpIpLimiter, otpPhoneLimiter } from '../middleware/rateLimiter';

const router = Router();

router.post('/register', otpIpLimiter, register);
router.post('/login', otpIpLimiter, login);
router.post('/otp/request', otpIpLimiter, otpPhoneLimiter, requestOtp);
router.post('/otp/verify', verifyOtp);
router.post('/token/refresh', refreshToken);
router.post('/logout', authenticate, logout);
router.post('/admin/request', requestAdminAccess);

export default router;
