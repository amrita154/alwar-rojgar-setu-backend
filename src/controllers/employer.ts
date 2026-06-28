import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { toCamelCase } from '../utils';
import * as employerService from '../services/employer';

export async function createEmployerProfile(req: AuthRequest, res: Response): Promise<void> {
  const userId = req.user!.userId;

  const existing = await employerService.getProfileByUserId(userId);
  if (existing) {
    res.status(409).json({ message: 'Profile already exists' });
    return;
  }

  if (!req.body.companyName) {
    res.status(400).json({ message: 'Company name is required' });
    return;
  }

  const profile = await employerService.createProfile(userId, req.body);
  res.status(201).json(profile);
}

export async function getEmployerProfile(req: AuthRequest, res: Response): Promise<void> {
  const userId = req.user!.userId;
  const profile = await employerService.getProfileByUserId(userId);

  if (!profile) {
    res.status(404).json({ message: 'Profile not found' });
    return;
  }

  res.json(toCamelCase(profile));
}

export async function updateEmployerProfile(req: AuthRequest, res: Response): Promise<void> {
  const userId = req.user!.userId;
  const updated = await employerService.updateProfile(userId, req.body);

  if (!updated) {
    res.status(400).json({ message: 'No fields to update or profile not found' });
    return;
  }

  res.json(updated);
}

export async function getEmployerDocuments(req: AuthRequest, res: Response): Promise<void> {
  const userId = req.user!.userId;
  const employerId = await employerService.getProfileId(userId);

  if (!employerId) {
    res.status(404).json({ message: 'Profile not found' });
    return;
  }

  const docs = await employerService.getDocuments(employerId);
  res.json(docs);
}

export async function uploadEmployerDocument(req: AuthRequest, res: Response): Promise<void> {
  const userId = req.user!.userId;

  if (!req.file) {
    res.status(400).json({ message: 'File is required' });
    return;
  }

  const { documentType } = req.body;
  const validTypes = ['GST_CERTIFICATE', 'UDYAM_CERTIFICATE', 'FACTORY_LICENSE', 'PAN_CARD', 'OTHER'];
  if (!validTypes.includes(documentType)) {
    res.status(400).json({ message: 'Invalid document type' });
    return;
  }

  const employerId = await employerService.getProfileId(userId);
  if (!employerId) {
    res.status(404).json({ message: 'Profile not found. Create profile first.' });
    return;
  }

  const fileUrl = `/uploads/${req.file.filename}`;
  const doc = await employerService.addDocument(employerId, documentType, fileUrl);
  res.status(201).json(doc);
}

export async function deleteEmployerDocument(req: AuthRequest, res: Response): Promise<void> {
  const userId = req.user!.userId;
  const { documentId } = req.params;

  const employerId = await employerService.getProfileId(userId);
  if (!employerId) {
    res.status(404).json({ message: 'Profile not found' });
    return;
  }

  const deleted = await employerService.removeDocument(documentId, employerId);
  if (!deleted) {
    res.status(404).json({ message: 'Document not found' });
    return;
  }

  res.status(204).send();
}
