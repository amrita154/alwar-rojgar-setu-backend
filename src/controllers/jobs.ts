import { Request, Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { parsePagination, paginatedResponse } from '../utils';
import * as jobsService from '../services/jobs';
import * as employerService from '../services/employer';

export async function searchJobs(req: Request, res: Response): Promise<void> {
  const { district, tradeRequired, jobType, minSalary, maxSalary } = req.query;
  const { page, limit, offset } = parsePagination(req.query as { page?: string; limit?: string });

  const { data, total } = await jobsService.search({
    district: district as string | undefined,
    tradeRequired: tradeRequired as string | undefined,
    jobType: jobType as string | undefined,
    minSalary: minSalary ? parseInt(minSalary as string, 10) : undefined,
    maxSalary: maxSalary ? parseInt(maxSalary as string, 10) : undefined,
    limit,
    offset,
  });

  res.json(paginatedResponse(data, total, page, limit));
}

export async function getJob(req: Request, res: Response): Promise<void> {
  const { jobId } = req.params;
  const job = await jobsService.getById(jobId);

  if (!job) {
    res.status(404).json({ message: 'Job not found' });
    return;
  }

  res.json(job);
}

export async function getOwnedJobs(req: AuthRequest, res: Response): Promise<void> {
  const userId = req.user!.userId;
  const employerId = await employerService.getProfileId(userId);

  if (!employerId) {
    res.status(404).json({ message: 'Employer profile not found' });
    return;
  }

  const data = await jobsService.getOwned(employerId);
  res.json(paginatedResponse(data, data.length, 1, data.length));
}

export async function createJob(req: AuthRequest, res: Response): Promise<void> {
  const userId = req.user!.userId;
  const employerId = await employerService.getProfileId(userId);

  if (!employerId) {
    res.status(404).json({ message: 'Employer profile not found. Create profile first.' });
    return;
  }

  const { title, description, grossSalary, netSalary, jobType, district } = req.body;
  if (!title || !description || !grossSalary || !netSalary || !jobType || !district) {
    res.status(400).json({ message: 'Missing required fields: title, description, grossSalary, netSalary, jobType, district' });
    return;
  }

  const job = await jobsService.create(employerId, req.body);
  res.status(201).json(job);
}

export async function updateJob(req: AuthRequest, res: Response): Promise<void> {
  const userId = req.user!.userId;
  const { jobId } = req.params;

  const employerId = await employerService.getProfileId(userId);
  if (!employerId) {
    res.status(403).json({ message: 'Not authorized' });
    return;
  }

  const updated = await jobsService.update(jobId, employerId, req.body);
  if (!updated) {
    res.status(404).json({ message: 'Job not found, not owned by you, or no fields to update' });
    return;
  }

  res.json(updated);
}

export async function closeJob(req: AuthRequest, res: Response): Promise<void> {
  const userId = req.user!.userId;
  const { jobId } = req.params;

  const employerId = await employerService.getProfileId(userId);
  if (!employerId) {
    res.status(403).json({ message: 'Not authorized' });
    return;
  }

  const closed = await jobsService.close(jobId, employerId);
  if (!closed) {
    res.status(404).json({ message: 'Job not found or not owned by you' });
    return;
  }

  res.json(closed);
}

export async function getJobApplicants(req: AuthRequest, res: Response): Promise<void> {
  const { jobId } = req.params;
  const userId = req.user!.userId;
  const role = req.user!.role;

  if (role === 'employer') {
    const employerId = await employerService.getProfileId(userId);
    if (!employerId) {
      res.status(403).json({ message: 'Not authorized' });
      return;
    }
    const owns = await jobsService.isOwnedBy(jobId, employerId);
    if (!owns) {
      res.status(404).json({ message: 'Job not found or not owned by you' });
      return;
    }
  }

  const data = await jobsService.getApplicants(jobId);
  res.json(paginatedResponse(data, data.length, 1, data.length));
}
