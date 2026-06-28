import { Router } from 'express';
import { authenticate, requireRole } from '../middleware/auth';
import { upload } from '../middleware/upload';
import {
  createCandidateProfile,
  getCandidateProfile,
  updateCandidateProfile,
  uploadResume,
  uploadAadhaar,
  uploadCertificate,
  getCandidateApplications,
} from '../controllers/candidate';

const router = Router();

router.use(authenticate, requireRole('candidate'));

router.post('/', createCandidateProfile);
router.get('/', getCandidateProfile);
router.patch('/', updateCandidateProfile);
router.post('/resume', upload.single('file'), uploadResume);
router.post('/aadhaar', upload.single('file'), uploadAadhaar);
router.post('/certificates', upload.single('file'), uploadCertificate);
router.get('/applications', getCandidateApplications);

export default router;
