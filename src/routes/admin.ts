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
  getAdmins,
  approveAdmin,
  rejectAdmin,
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
router.get('/admins', getAdmins);
router.patch('/admins/:userId/approve', approveAdmin);
router.patch('/admins/:userId/reject', rejectAdmin);

export default router;
