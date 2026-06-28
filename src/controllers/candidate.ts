import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { parsePagination, paginatedResponse } from '../utils';
import * as candidateService from '../services/candidate';

export async function createCandidateProfile(req: AuthRequest, res: Response): Promise<void> {
  const userId = req.user!.userId;

  const existing = await candidateService.getProfileByUserId(userId);
  if (existing) {
    res.status(409).json({ message: 'Profile already exists' });
    return;
  }

  if (!req.body.fullName) {
    res.status(400).json({ message: 'Full name is required' });
    return;
  }

  const profile = await candidateService.createProfile(userId, req.body);
  res.status(201).json(profile);
}

export async function getCandidateProfile(req: AuthRequest, res: Response): Promise<void> {
  const userId = req.user!.userId;
  const profile = await candidateService.getProfileByUserId(userId);

  if (!profile) {
    res.status(404).json({ message: 'Profile not found' });
    return;
  }

  const { toCamelCase } = await import('../utils');
  res.json(toCamelCase(profile));
}

export async function updateCandidateProfile(req: AuthRequest, res: Response): Promise<void> {
  const userId = req.user!.userId;
  const updated = await candidateService.updateProfile(userId, req.body);

  if (!updated) {
    res.status(400).json({ message: 'No fields to update or profile not found' });
    return;
  }

  res.json(updated);
}

export async function uploadResume(req: AuthRequest, res: Response): Promise<void> {
  const userId = req.user!.userId;
  if (!req.file) {
    res.status(400).json({ message: 'File is required' });
    return;
  }

  const fileUrl = `/uploads/${req.file.filename}`;
  const result = await candidateService.setFileUrl(userId, 'resume_url', fileUrl);

  if (!result) {
    res.status(404).json({ message: 'Profile not found. Create profile first.' });
    return;
  }

  res.json(result);
}

export async function uploadAadhaar(req: AuthRequest, res: Response): Promise<void> {
  const userId = req.user!.userId;
  if (!req.file) {
    res.status(400).json({ message: 'File is required' });
    return;
  }

  const fileUrl = `/uploads/${req.file.filename}`;
  const result = await candidateService.setFileUrl(userId, 'aadhaar_url', fileUrl);

  if (!result) {
    res.status(404).json({ message: 'Profile not found. Create profile first.' });
    return;
  }

  res.json(result);
}

export async function uploadCertificate(req: AuthRequest, res: Response): Promise<void> {
  const userId = req.user!.userId;
  if (!req.file) {
    res.status(400).json({ message: 'File is required' });
    return;
  }

  const { documentType } = req.body;
  const columnMap: Record<string, string> = {
    ITI_CERTIFICATE: 'iti_certificate_url',
    DIPLOMA_CERTIFICATE: 'diploma_certificate_url',
    DEGREE_CERTIFICATE: 'degree_certificate_url',
    EXPERIENCE_LETTER: 'experience_letter_url',
  };

  const column = columnMap[documentType];
  if (!column) {
    res.status(400).json({ message: 'Invalid documentType' });
    return;
  }

  const fileUrl = `/uploads/${req.file.filename}`;
  const result = await candidateService.setFileUrl(userId, column, fileUrl);

  if (!result) {
    res.status(404).json({ message: 'Profile not found. Create profile first.' });
    return;
  }

  res.json(result);
}

export async function getCandidateApplications(req: AuthRequest, res: Response): Promise<void> {
  const userId = req.user!.userId;

  const candidateId = await candidateService.getProfileId(userId);
  if (!candidateId) {
    res.status(404).json({ message: 'Profile not found' });
    return;
  }

  const { page, limit, offset } = parsePagination(req.query as { page?: string; limit?: string });
  const { status } = req.query;

  const { data, total } = await candidateService.getApplications(candidateId, {
    status: status as string | undefined,
    limit,
    offset,
  });

  res.json(paginatedResponse(data, total, page, limit));
}
