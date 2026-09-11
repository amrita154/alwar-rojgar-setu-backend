import { Router } from 'express';
import { authenticate, requireRole, requireSuperAdmin } from '../middleware/auth';
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
  grantAdminAccess,
  getAdminInvites,
  cancelAdminInvite,
} from '../controllers/admin';

const router = Router();

router.use(authenticate, requireRole('admin'));

// Read-only routes — all admins
router.get('/dashboard', getDashboard);
router.get('/employers', getAdminEmployers);
router.get('/employers/:employerId', getAdminEmployer);
router.get('/candidates', getAdminCandidates);
router.get('/candidates/:candidateId', getAdminCandidate);
router.get('/admins', getAdmins);
router.get('/admin-invites', getAdminInvites);

// Write routes — super_admin only
router.patch('/employers/:employerId/verification', requireSuperAdmin, verifyEmployer);
router.patch('/users/:userId/disable', requireSuperAdmin, disableUser);
router.patch('/users/:userId/enable', requireSuperAdmin, enableUser);
router.post('/admins/grant', requireSuperAdmin, grantAdminAccess);
router.delete('/admin-invites/:inviteId', requireSuperAdmin, cancelAdminInvite);

export default router;
