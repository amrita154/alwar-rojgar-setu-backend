import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import * as candidateService from '../services/candidate';
import * as applicationsService from '../services/applications';

export async function applyToJob(req: AuthRequest, res: Response): Promise<void> {
  const userId = req.user!.userId;
  const { jobId } = req.body;

  if (!jobId) {
    res.status(400).json({ message: 'jobId is required' });
    return;
  }

  const candidateId = await candidateService.getProfileId(userId);
  if (!candidateId) {
    res.status(400).json({ message: 'Complete your profile before applying' });
    return;
  }

  const result = await applicationsService.apply(candidateId, jobId);

  if ('error' in result) {
    res.status(result.statusCode!).json({ message: result.error });
    return;
  }

  res.status(201).json(result.data);
}

export async function updateApplicationStatus(req: AuthRequest, res: Response): Promise<void> {
  const { applicationId } = req.params;
  const { status, reason, attributedToPlatform, joiningDate } = req.body;

  const validStatuses = ['received', 'viewed', 'shortlisted', 'rejected', 'hired'];
  if (!status || !validStatuses.includes(status)) {
    res.status(400).json({ message: 'Invalid status' });
    return;
  }

  const updated = await applicationsService.updateStatus(applicationId, status, {
    reason,
    attributedToPlatform,
    joiningDate,
  });

  if (!updated) {
    res.status(404).json({ message: 'Application not found' });
    return;
  }

  res.json(updated);
}
