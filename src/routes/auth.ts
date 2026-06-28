import { Router } from 'express';
import { requestOtp, verifyOtp, refreshToken, logout } from '../controllers/auth';
import { authenticate, AuthRequest } from '../middleware/auth';
import { otpIpLimiter, otpPhoneLimiter } from '../middleware/rateLimiter';

const router = Router();

router.post('/otp/request', otpIpLimiter, otpPhoneLimiter, requestOtp);
router.post('/otp/verify', verifyOtp);
router.post('/token/refresh', refreshToken);
router.post('/logout', authenticate, logout);

export default router;
