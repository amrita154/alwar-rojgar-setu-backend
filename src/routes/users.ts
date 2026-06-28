import { Router } from 'express';
import { getCurrentUser } from '../controllers/users';
import { authenticate } from '../middleware/auth';

const router = Router();

router.get('/current', authenticate, getCurrentUser);

export default router;
