import { Request, Response } from 'express';
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

export async function searchJobs(req: Request, res: Response): Promise<void> {
  const { district, tradeRequired, jobType, minSalary, maxSalary, page = '1', limit = '10' } = req.query;
  const pageNum = Math.max(1, parseInt(page as string, 10));
  const limitNum = Math.min(50, Math.max(1, parseInt(limit as string, 10)));
  const offset = (pageNum - 1) * limitNum;

  let where = "WHERE j.status = 'active'";
  const params: unknown[] = [];

  if (district) {
    params.push(district);
    where += ` AND j.district = $${params.length}`;
  }
  if (tradeRequired) {
    params.push(tradeRequired);
    where += ` AND j.trade_required = $${params.length}`;
  }
  if (jobType) {
    params.push(jobType);
    where += ` AND j.job_type = $${params.length}`;
  }
  if (minSalary) {
    params.push(parseInt(minSalary as string, 10));
    where += ` AND j.net_salary >= $${params.length}`;
  }
  if (maxSalary) {
    params.push(parseInt(maxSalary as string, 10));
    where += ` AND j.net_salary <= $${params.length}`;
  }

  const countResult = await pool.query(
    `SELECT COUNT(*) FROM jobs j ${where}`, params
  );
  const total = parseInt(countResult.rows[0].count, 10);

  params.push(limitNum, offset);
  const result = await pool.query(
    `SELECT j.*, ep.company_name
     FROM jobs j
     LEFT JOIN employer_profiles ep ON ep.id = j.employer_id
     ${where}
     ORDER BY j.posted_at DESC
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

export async function getJob(req: Request, res: Response): Promise<void> {
  const { jobId } = req.params;

  const result = await pool.query(
    `SELECT j.*, ep.company_name
     FROM jobs j
     LEFT JOIN employer_profiles ep ON ep.id = j.employer_id
     WHERE j.id = $1`,
    [jobId]
  );

  if (result.rows.length === 0) {
    res.status(404).json({ message: 'Job not found' });
    return;
  }

  res.json(toCamelCase(result.rows[0]));
}

export async function getOwnedJobs(req: AuthRequest, res: Response): Promise<void> {
  const userId = req.user!.userId;

  const profile = await pool.query('SELECT id FROM employer_profiles WHERE user_id = $1', [userId]);
  if (profile.rows.length === 0) {
    res.status(404).json({ message: 'Employer profile not found' });
    return;
  }

  const employerId = profile.rows[0].id;
  const result = await pool.query(
    `SELECT j.*, ep.company_name
     FROM jobs j
     LEFT JOIN employer_profiles ep ON ep.id = j.employer_id
     WHERE j.employer_id = $1
     ORDER BY j.created_at DESC`,
    [employerId]
  );

  res.json({
    data: result.rows.map(toCamelCase),
    page: 1,
    limit: result.rows.length,
    total: result.rows.length,
    totalPages: 1,
  });
}

export async function createJob(req: AuthRequest, res: Response): Promise<void> {
  const userId = req.user!.userId;

  const profile = await pool.query('SELECT id FROM employer_profiles WHERE user_id = $1', [userId]);
  if (profile.rows.length === 0) {
    res.status(404).json({ message: 'Employer profile not found. Create profile first.' });
    return;
  }

  const { title, description, grossSalary, netSalary, jobType, openings, tradeRequired, district } = req.body;

  if (!title || !description || !grossSalary || !netSalary || !jobType || !district) {
    res.status(400).json({ message: 'Missing required fields: title, description, grossSalary, netSalary, jobType, district' });
    return;
  }

  const result = await pool.query(
    `INSERT INTO jobs (employer_id, title, description, gross_salary, net_salary, job_type, openings, trade_required, district)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
    [profile.rows[0].id, title, description, grossSalary, netSalary, jobType, openings || 1, tradeRequired || null, district]
  );

  res.status(201).json(toCamelCase(result.rows[0]));
}

export async function updateJob(req: AuthRequest, res: Response): Promise<void> {
  const userId = req.user!.userId;
  const { jobId } = req.params;

  const profile = await pool.query('SELECT id FROM employer_profiles WHERE user_id = $1', [userId]);
  if (profile.rows.length === 0) {
    res.status(403).json({ message: 'Not authorized' });
    return;
  }

  // Verify ownership
  const job = await pool.query('SELECT id FROM jobs WHERE id = $1 AND employer_id = $2', [jobId, profile.rows[0].id]);
  if (job.rows.length === 0) {
    res.status(404).json({ message: 'Job not found or not owned by you' });
    return;
  }

  const fields: string[] = [];
  const values: unknown[] = [];
  let idx = 1;

  const allowedFields: Record<string, string> = {
    title: 'title',
    description: 'description',
    grossSalary: 'gross_salary',
    netSalary: 'net_salary',
    jobType: 'job_type',
    openings: 'openings',
    tradeRequired: 'trade_required',
    district: 'district',
  };

  for (const [camelKey, dbKey] of Object.entries(allowedFields)) {
    if (req.body[camelKey] !== undefined) {
      fields.push(`${dbKey} = $${idx}`);
      values.push(req.body[camelKey]);
      idx++;
    }
  }

  if (fields.length === 0) {
    res.status(400).json({ message: 'No fields to update' });
    return;
  }

  values.push(jobId);
  const result = await pool.query(
    `UPDATE jobs SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`,
    values
  );

  res.json(toCamelCase(result.rows[0]));
}

export async function closeJob(req: AuthRequest, res: Response): Promise<void> {
  const userId = req.user!.userId;
  const { jobId } = req.params;

  const profile = await pool.query('SELECT id FROM employer_profiles WHERE user_id = $1', [userId]);
  if (profile.rows.length === 0) {
    res.status(403).json({ message: 'Not authorized' });
    return;
  }

  const result = await pool.query(
    `UPDATE jobs SET status = 'closed' WHERE id = $1 AND employer_id = $2 RETURNING *`,
    [jobId, profile.rows[0].id]
  );

  if (result.rows.length === 0) {
    res.status(404).json({ message: 'Job not found or not owned by you' });
    return;
  }

  res.json(toCamelCase(result.rows[0]));
}

export async function getJobApplicants(req: AuthRequest, res: Response): Promise<void> {
  const { jobId } = req.params;
  const userId = req.user!.userId;
  const role = req.user!.role;

  // Admin can see all, employer must own the job
  if (role === 'employer') {
    const profile = await pool.query('SELECT id FROM employer_profiles WHERE user_id = $1', [userId]);
    if (profile.rows.length === 0) {
      res.status(403).json({ message: 'Not authorized' });
      return;
    }
    const job = await pool.query('SELECT id FROM jobs WHERE id = $1 AND employer_id = $2', [jobId, profile.rows[0].id]);
    if (job.rows.length === 0) {
      res.status(404).json({ message: 'Job not found or not owned by you' });
      return;
    }
  }

  const result = await pool.query(
    `SELECT a.*, row_to_json(cp.*) as candidate
     FROM applications a
     LEFT JOIN candidate_profiles cp ON cp.id = a.candidate_id
     WHERE a.job_id = $1
     ORDER BY a.created_at DESC`,
    [jobId]
  );

  const data = result.rows.map((row) => {
    const { candidate, ...app } = row;
    return { ...toCamelCase(app), candidate: candidate ? toCamelCase(candidate) : null };
  });

  res.json({
    data,
    page: 1,
    limit: data.length,
    total: data.length,
    totalPages: 1,
  });
}
