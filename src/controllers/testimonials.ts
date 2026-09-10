import { Request, Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import * as testimonialService from '../services/testimonials';

export async function getPublicTestimonials(_req: Request, res: Response): Promise<void> {
  const testimonials = await testimonialService.listPublished();
  res.json(testimonials);
}

export async function adminListTestimonials(_req: AuthRequest, res: Response): Promise<void> {
  const testimonials = await testimonialService.listAll();
  res.json(testimonials);
}

export async function adminCreateTestimonial(req: AuthRequest, res: Response): Promise<void> {
  const { name, body } = req.body;
  if (!name || !body) {
    res.status(400).json({ message: 'name and body are required' });
    return;
  }
  const testimonial = await testimonialService.create(req.body);
  res.status(201).json(testimonial);
}

export async function adminUpdateTestimonial(req: AuthRequest, res: Response): Promise<void> {
  const { id } = req.params;
  const updated = await testimonialService.update(id, req.body);
  if (!updated) {
    res.status(404).json({ message: 'Testimonial not found' });
    return;
  }
  res.json(updated);
}

export async function adminDeleteTestimonial(req: AuthRequest, res: Response): Promise<void> {
  const { id } = req.params;
  const deleted = await testimonialService.remove(id);
  if (!deleted) {
    res.status(404).json({ message: 'Testimonial not found' });
    return;
  }
  res.status(204).send();
}
