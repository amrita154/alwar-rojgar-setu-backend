import { Response } from 'express';
import { pool } from '../config/database';
import { AuthRequest } from '../middleware/auth';

function toCamelCase(row: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(row)) {
    const camelKey = key.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
    result[camelKey] = value;
  }
  return result;
}

export async function getDashboard(_req: AuthRequest, res: Response): Promise<void> {
  const candidates = await pool.query('SELECT COUNT(*) FROM candidate_profiles');
  const employers = await pool.query('SELECT COUNT(*) FROM employer_profiles');
  const pendingEmployers = await pool.query("SELECT COUNT(*) FROM employer_profiles WHERE status = 'pending'");
  const activeJobs = await pool.query("SELECT COUNT(*) FROM jobs WHERE status = 'active'");
  const totalApplications = await pool.query('SELECT COUNT(*) FROM applications');
  const totalPlacements = await pool.query("SELECT COUNT(*) FROM applications WHERE status = 'hired'");
  const verifiedPlacements = await pool.query(
    "SELECT COUNT(*) FROM applications WHERE status = 'hired' AND attributed_to_platform = true"
  );

  // Registrations by month (last 6 months)
  const registrationsByMonth = await pool.query(`
    SELECT to_char(created_at, 'YYYY-MM') as month, COUNT(*) as count
    FROM users WHERE role IN ('candidate', 'employer')
    AND created_at > NOW() - INTERVAL '6 months'
    GROUP BY month ORDER BY month
  `);

  // Placements by month
  const placementsByMonth = await pool.query(`
    SELECT to_char(hired_at, 'YYYY-MM') as month, COUNT(*) as count
    FROM applications WHERE status = 'hired' AND hired_at IS NOT NULL
    AND hired_at > NOW() - INTERVAL '6 months'
    GROUP BY month ORDER BY month
  `);

  // Applications by status
  const applicationsByStatus = await pool.query(`
    SELECT status, COUNT(*) as count FROM applications GROUP BY status
  `);

  res.json({
    totalCandidates: parseInt(candidates.rows[0].count, 10),
    totalEmployers: parseInt(employers.rows[0].count, 10),
    pendingEmployers: parseInt(pendingEmployers.rows[0].count, 10),
    activeJobs: parseInt(activeJobs.rows[0].count, 10),
    totalApplications: parseInt(totalApplications.rows[0].count, 10),
    totalPlacements: parseInt(totalPlacements.rows[0].count, 10),
    verifiedPlacements: parseInt(verifiedPlacements.rows[0].count, 10),
    registrationsByMonth: registrationsByMonth.rows.map(r => ({ month: r.month, count: parseInt(r.count, 10) })),
    placementsByMonth: placementsByMonth.rows.map(r => ({ month: r.month, count: parseInt(r.count, 10) })),
    applicationsByStatus: applicationsByStatus.rows.map(r => ({ status: r.status, count: parseInt(r.count, 10) })),
  });
}

export async function getAdminEmployers(req: AuthRequest, res: Response): Promise<void> {
  const { page = '1', limit = '10', status, search } = req.query;
  const pageNum = Math.max(1, parseInt(page as string, 10));
  const limitNum = Math.min(50, Math.max(1, parseInt(limit as string, 10)));
  const offset = (pageNum - 1) * limitNum;

  let where = 'WHERE 1=1';
  const params: unknown[] = [];

  if (status) {
    params.push(status);
    where += ` AND ep.status = $${params.length}`;
  }
  if (search) {
    params.push(`%${search}%`);
    where += ` AND ep.company_name ILIKE $${params.length}`;
  }

  const countResult = await pool.query(`SELECT COUNT(*) FROM employer_profiles ep ${where}`, params);
  const total = parseInt(countResult.rows[0].count, 10);

  params.push(limitNum, offset);
  const result = await pool.query(
    `SELECT ep.*, u.is_active FROM employer_profiles ep
     JOIN users u ON u.id = ep.user_id
     ${where} ORDER BY ep.created_at DESC
     LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  );

  res.json({
    data: result.rows.map(toCamelCase),
    page: pageNum,
    limit: limitNum,
    total,
    totalPages: Math.ceil(total / limitNum),
  });
}

export async function getAdminEmployer(req: AuthRequest, res: Response): Promise<void> {
  const { employerId } = req.params;

  const result = await pool.query(
    `SELECT ep.*, u.is_active FROM employer_profiles ep
     JOIN users u ON u.id = ep.user_id
     WHERE ep.id = $1`,
    [employerId]
  );

  if (result.rows.length === 0) {
    res.status(404).json({ message: 'Employer not found' });
    return;
  }

  res.json(toCamelCase(result.rows[0]));
}

export async function verifyEmployer(req: AuthRequest, res: Response): Promise<void> {
  const { employerId } = req.params;
  const { status, reason } = req.body;
  const adminId = req.user!.userId;

  if (!['verified', 'rejected'].includes(status)) {
    res.status(400).json({ message: 'Status must be verified or rejected' });
    return;
  }

  const updates = ['status = $1', 'verified_by = $2', 'verified_at = $3'];
  const values: unknown[] = [status, adminId, new Date()];

  if (status === 'rejected' && reason) {
    updates.push('rejection_reason = $4');
    values.push(reason);
    values.push(employerId);
    const result = await pool.query(
      `UPDATE employer_profiles SET ${updates.join(', ')} WHERE id = $5 RETURNING *`,
      values
    );
    if (result.rows.length === 0) {
      res.status(404).json({ message: 'Employer not found' });
      return;
    }
    res.json(toCamelCase(result.rows[0]));
  } else {
    values.push(employerId);
    const result = await pool.query(
      `UPDATE employer_profiles SET ${updates.join(', ')} WHERE id = $4 RETURNING *`,
      values
    );
    if (result.rows.length === 0) {
      res.status(404).json({ message: 'Employer not found' });
      return;
    }
    res.json(toCamelCase(result.rows[0]));
  }
}

export async function getAdminCandidates(req: AuthRequest, res: Response): Promise<void> {
  const { page = '1', limit = '10', search, department } = req.query;
  const pageNum = Math.max(1, parseInt(page as string, 10));
  const limitNum = Math.min(50, Math.max(1, parseInt(limit as string, 10)));
  const offset = (pageNum - 1) * limitNum;

  let where = 'WHERE 1=1';
  const params: unknown[] = [];

  if (search) {
    params.push(`%${search}%`);
    where += ` AND cp.full_name ILIKE $${params.length}`;
  }
  if (department) {
    params.push(department);
    where += ` AND cp.department = $${params.length}`;
  }

  const countResult = await pool.query(`SELECT COUNT(*) FROM candidate_profiles cp ${where}`, params);
  const total = parseInt(countResult.rows[0].count, 10);

  params.push(limitNum, offset);
  const result = await pool.query(
    `SELECT cp.*, u.is_active FROM candidate_profiles cp
     JOIN users u ON u.id = cp.user_id
     ${where} ORDER BY cp.created_at DESC
     LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  );

  res.json({
    data: result.rows.map(toCamelCase),
    page: pageNum,
    limit: limitNum,
    total,
    totalPages: Math.ceil(total / limitNum),
  });
}

export async function getAdminCandidate(req: AuthRequest, res: Response): Promise<void> {
  const { candidateId } = req.params;

  const result = await pool.query(
    `SELECT cp.*, u.is_active FROM candidate_profiles cp
     JOIN users u ON u.id = cp.user_id
     WHERE cp.id = $1`,
    [candidateId]
  );

  if (result.rows.length === 0) {
    res.status(404).json({ message: 'Candidate not found' });
    return;
  }

  res.json(toCamelCase(result.rows[0]));
}

export async function disableUser(req: AuthRequest, res: Response): Promise<void> {
  const { userId } = req.params;

  const result = await pool.query(
    'UPDATE users SET is_active = false WHERE id = $1 RETURNING id',
    [userId]
  );

  if (result.rows.length === 0) {
    res.status(404).json({ message: 'User not found' });
    return;
  }

  res.json({ message: 'User disabled' });
}

export async function enableUser(req: AuthRequest, res: Response): Promise<void> {
  const { userId } = req.params;

  const result = await pool.query(
    'UPDATE users SET is_active = true WHERE id = $1 RETURNING id',
    [userId]
  );

  if (result.rows.length === 0) {
    res.status(404).json({ message: 'User not found' });
    return;
  }

  res.json({ message: 'User enabled' });
}
