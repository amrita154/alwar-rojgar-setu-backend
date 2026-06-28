import { Router } from 'express';
import { authenticate, requireRole } from '../middleware/auth';
import { upload } from '../middleware/upload';
import {
  createEmployerProfile,
  getEmployerProfile,
  updateEmployerProfile,
  getEmployerDocuments,
  uploadEmployerDocument,
  deleteEmployerDocument,
} from '../controllers/employer';

const router = Router();

router.use(authenticate, requireRole('employer'));

router.post('/', createEmployerProfile);
router.get('/', getEmployerProfile);
router.patch('/', updateEmployerProfile);
router.get('/documents', getEmployerDocuments);
router.post('/documents', upload.single('file'), uploadEmployerDocument);
router.delete('/documents/:documentId', deleteEmployerDocument);

export default router;
