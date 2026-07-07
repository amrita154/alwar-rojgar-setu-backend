import { Router } from 'express';
import { translate } from '../controllers/translate';
import { translationLimiter } from '../middleware/rateLimiter';

const router = Router();

router.post('/', translationLimiter, translate);

export default router;
