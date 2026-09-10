import { Router } from 'express';
import { authenticate, requireRole, requireSuperAdmin } from '../middleware/auth';
import {
  getPublicTestimonials,
  adminListTestimonials,
  adminCreateTestimonial,
  adminUpdateTestimonial,
  adminDeleteTestimonial,
} from '../controllers/testimonials';

const router = Router();

// Public — no auth required
router.get('/', getPublicTestimonials);

// Read — all admins
router.get('/admin', authenticate, requireRole('admin'), adminListTestimonials);

// Write — super_admin only
router.post('/admin', authenticate, requireRole('admin'), requireSuperAdmin, adminCreateTestimonial);
router.patch('/admin/:id', authenticate, requireRole('admin'), requireSuperAdmin, adminUpdateTestimonial);
router.delete('/admin/:id', authenticate, requireRole('admin'), requireSuperAdmin, adminDeleteTestimonial);

export default router;
