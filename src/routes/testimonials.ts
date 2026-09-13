import { Router } from 'express';
import { authenticate, requireRole } from '../middleware/auth';
import {
  getPublicTestimonials,
  adminListTestimonials,
  candidateCreateTestimonial,
  adminUpdateTestimonial,
  adminDeleteTestimonial,
} from '../controllers/testimonials';

const router = Router();

// Public — no auth required
router.get('/', getPublicTestimonials);

// Candidate — submit own testimonial
router.post('/candidate', authenticate, requireRole('candidate'), candidateCreateTestimonial);

// Admin — list, publish/unpublish, delete (no create, no edit content)
router.get('/admin', authenticate, requireRole('admin'), adminListTestimonials);
router.patch('/admin/:id', authenticate, requireRole('admin'), adminUpdateTestimonial);
router.delete('/admin/:id', authenticate, requireRole('admin'), adminDeleteTestimonial);

export default router;
