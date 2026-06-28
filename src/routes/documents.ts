import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { serveDocument } from '../controllers/documents';

const router = Router();

router.get('/:filename', authenticate, serveDocument);

export default router;
