import { Router } from 'express';
import { authenticate, requireRole } from '../middleware/auth';
import {
  searchJobs,
  getJob,
  getOwnedJobs,
  createJob,
  updateJob,
  closeJob,
  getJobApplicants,
} from '../controllers/jobs';

const router = Router();

// Public routes
router.get('/', searchJobs);
router.get('/owned', authenticate, requireRole('employer'), getOwnedJobs);
router.get('/:jobId', getJob);

// Employer routes
router.post('/', authenticate, requireRole('employer'), createJob);
router.patch('/:jobId', authenticate, requireRole('employer'), updateJob);
router.patch('/:jobId/close', authenticate, requireRole('employer'), closeJob);

// Employer/Admin routes
router.get('/:jobId/applications', authenticate, requireRole('employer', 'admin'), getJobApplicants);

export default router;
