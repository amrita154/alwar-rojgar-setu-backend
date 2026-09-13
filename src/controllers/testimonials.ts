import { Request, Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import * as testimonialService from '../services/testimonials';
import * as candidateService from '../services/candidate';

export async function getPublicTestimonials(_req: Request, res: Response): Promise<void> {
  const testimonials = await testimonialService.listPublished();
  res.json(testimonials);
}

export async function adminListTestimonials(_req: AuthRequest, res: Response): Promise<void> {
  const testimonials = await testimonialService.listAll();
  res.json(testimonials);
}

export async function candidateCreateTestimonial(req: AuthRequest, res: Response): Promise<void> {
  const userId = req.user!.userId;
  const { body } = req.body;
  if (!body || !String(body).trim()) {
    res.status(400).json({ message: 'body is required' });
    return;
  }

  const profile = await candidateService.getProfileByUserId(userId);
  if (!profile) {
    res.status(404).json({ message: 'Candidate profile not found' });
    return;
  }

  const testimonial = await testimonialService.create({
    candidateId: profile.id,
    name: profile.full_name,
    trade: profile.iti_trade ?? null,
    photoUrl: profile.photo_url ?? null,
    body: String(body).trim(),
    isPublished: false,
    displayOrder: 0,
  });
  res.status(201).json(testimonial);
}

export async function adminUpdateTestimonial(req: AuthRequest, res: Response): Promise<void> {
  const { id } = req.params;
  const { isPublished, displayOrder } = req.body;
  const updated = await testimonialService.adminUpdate(id, { isPublished, displayOrder });
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
