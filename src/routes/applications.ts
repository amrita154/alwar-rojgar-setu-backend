import { Router } from 'express';
import { authenticate, requireRole } from '../middleware/auth';
import { applyToJob, updateApplicationStatus, scheduleInterview } from '../controllers/applications';

const router = Router();

router.post('/', authenticate, requireRole('candidate'), applyToJob);
router.patch('/:applicationId/status', authenticate, requireRole('employer', 'admin'), updateApplicationStatus);
router.patch('/:applicationId/interview', authenticate, requireRole('employer', 'admin'), scheduleInterview);

export default router;
