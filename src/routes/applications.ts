import { Router } from 'express';
import { authenticate, requireRole } from '../middleware/auth';
import { applyToJob, updateApplicationStatus } from '../controllers/applications';

const router = Router();

router.post('/', authenticate, requireRole('candidate'), applyToJob);
router.patch('/:applicationId/status', authenticate, requireRole('employer', 'admin'), updateApplicationStatus);

export default router;
