import { Router } from 'express';
import { requestOtp, verifyOtp, refreshToken, logout } from '../controllers/auth';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router();

router.post('/otp/request', requestOtp);
router.post('/otp/verify', verifyOtp);
router.post('/token/refresh', refreshToken);
router.post('/logout', authenticate, logout);

export default router;
