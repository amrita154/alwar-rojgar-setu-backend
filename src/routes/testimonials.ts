import { Router } from 'express';
import { authenticate, requireRole } from '../middleware/auth';
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

// All admin routes — any admin (super_admin or read_only)
router.get('/admin', authenticate, requireRole('admin'), adminListTestimonials);
router.post('/admin', authenticate, requireRole('admin'), adminCreateTestimonial);
router.patch('/admin/:id', authenticate, requireRole('admin'), adminUpdateTestimonial);
router.delete('/admin/:id', authenticate, requireRole('admin'), adminDeleteTestimonial);

export default router;
