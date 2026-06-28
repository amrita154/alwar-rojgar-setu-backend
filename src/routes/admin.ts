import { Router } from 'express';
import { authenticate, requireRole } from '../middleware/auth';
import {
  getDashboard,
  getAdminEmployers,
  getAdminEmployer,
  verifyEmployer,
  getAdminCandidates,
  getAdminCandidate,
  disableUser,
  enableUser,
} from '../controllers/admin';

const router = Router();

router.use(authenticate, requireRole('admin'));

router.get('/dashboard', getDashboard);
router.get('/employers', getAdminEmployers);
router.get('/employers/:employerId', getAdminEmployer);
router.patch('/employers/:employerId/verification', verifyEmployer);
router.get('/candidates', getAdminCandidates);
router.get('/candidates/:candidateId', getAdminCandidate);
router.patch('/users/:userId/disable', disableUser);
router.patch('/users/:userId/enable', enableUser);

export default router;
