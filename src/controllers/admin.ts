import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { parsePagination, paginatedResponse } from '../utils';
import * as adminService from '../services/admin';

export async function getDashboard(_req: AuthRequest, res: Response): Promise<void> {
  const metrics = await adminService.getDashboardMetrics();
  res.json(metrics);
}

export async function getAdminEmployers(req: AuthRequest, res: Response): Promise<void> {
  const { status, search } = req.query;
  const { page, limit, offset } = parsePagination(req.query as { page?: string; limit?: string });

  const { data, total } = await adminService.listEmployers({
    status: status as string | undefined,
    search: search as string | undefined,
    limit,
    offset,
  });

  res.json(paginatedResponse(data, total, page, limit));
}

export async function getAdminEmployer(req: AuthRequest, res: Response): Promise<void> {
  const { employerId } = req.params;
  const employer = await adminService.getEmployerById(employerId);

  if (!employer) {
    res.status(404).json({ message: 'Employer not found' });
    return;
  }

  res.json(employer);
}

export async function verifyEmployer(req: AuthRequest, res: Response): Promise<void> {
  const { employerId } = req.params;
  const { status, reason } = req.body;
  const adminId = req.user!.userId;

  if (!['verified', 'rejected'].includes(status)) {
    res.status(400).json({ message: 'Status must be verified or rejected' });
    return;
  }

  const updated = await adminService.setEmployerVerification(employerId, adminId, status, reason);
  if (!updated) {
    res.status(404).json({ message: 'Employer not found' });
    return;
  }

  res.json(updated);
}

export async function getAdminCandidates(req: AuthRequest, res: Response): Promise<void> {
  const { search, department } = req.query;
  const { page, limit, offset } = parsePagination(req.query as { page?: string; limit?: string });

  const { data, total } = await adminService.listCandidates({
    search: search as string | undefined,
    department: department as string | undefined,
    limit,
    offset,
  });

  res.json(paginatedResponse(data, total, page, limit));
}

export async function getAdminCandidate(req: AuthRequest, res: Response): Promise<void> {
  const { candidateId } = req.params;
  const candidate = await adminService.getCandidateById(candidateId);

  if (!candidate) {
    res.status(404).json({ message: 'Candidate not found' });
    return;
  }

  res.json(candidate);
}

export async function disableUser(req: AuthRequest, res: Response): Promise<void> {
  const { userId } = req.params;
  const success = await adminService.setUserActive(userId, false);

  if (!success) {
    res.status(404).json({ message: 'User not found' });
    return;
  }

  res.json({ message: 'User disabled' });
}

export async function enableUser(req: AuthRequest, res: Response): Promise<void> {
  const { userId } = req.params;
  const success = await adminService.setUserActive(userId, true);

  if (!success) {
    res.status(404).json({ message: 'User not found' });
    return;
  }

  res.json({ message: 'User enabled' });
}

export async function getAdmins(req: AuthRequest, res: Response): Promise<void> {
  const { status, search } = req.query;
  const { page, limit, offset } = parsePagination(req.query as { page?: string; limit?: string });

  const { data, total } = await adminService.listAdmins({
    status: status as string | undefined,
    search: search as string | undefined,
    limit,
    offset,
  });

  res.json(paginatedResponse(data, total, page, limit));
}

export async function approveAdmin(req: AuthRequest, res: Response): Promise<void> {
  const { userId } = req.params;
  const updated = await adminService.setAdminStatus(userId, 'approved');

  if (!updated) {
    res.status(404).json({ message: 'Admin user not found' });
    return;
  }

  res.json(updated);
}

export async function rejectAdmin(req: AuthRequest, res: Response): Promise<void> {
  const { userId } = req.params;
  const updated = await adminService.setAdminStatus(userId, 'rejected');

  if (!updated) {
    res.status(404).json({ message: 'Admin user not found' });
    return;
  }

  res.json(updated);
}
