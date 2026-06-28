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

export async function applyToJob(req: AuthRequest, res: Response): Promise<void> {
  const userId = req.user!.userId;
  const { jobId } = req.body;

  if (!jobId) {
    res.status(400).json({ message: 'jobId is required' });
    return;
  }

  // Get candidate profile
  const profile = await pool.query('SELECT id FROM candidate_profiles WHERE user_id = $1', [userId]);
  if (profile.rows.length === 0) {
    res.status(400).json({ message: 'Complete your profile before applying' });
    return;
  }

  // Verify job exists and is active
  const job = await pool.query("SELECT id FROM jobs WHERE id = $1 AND status = 'active'", [jobId]);
  if (job.rows.length === 0) {
    res.status(404).json({ message: 'Job not found or not accepting applications' });
    return;
  }

  // Check duplicate application
  const existing = await pool.query(
    'SELECT id FROM applications WHERE candidate_id = $1 AND job_id = $2',
    [profile.rows[0].id, jobId]
  );
  if (existing.rows.length > 0) {
    res.status(409).json({ message: 'You have already applied to this job' });
    return;
  }

  const result = await pool.query(
    'INSERT INTO applications (candidate_id, job_id) VALUES ($1, $2) RETURNING *',
    [profile.rows[0].id, jobId]
  );

  res.status(201).json(toCamelCase(result.rows[0]));
}

export async function updateApplicationStatus(req: AuthRequest, res: Response): Promise<void> {
  const { applicationId } = req.params;
  const { status, reason, attributedToPlatform, joiningDate } = req.body;

  const validStatuses = ['received', 'viewed', 'shortlisted', 'rejected', 'hired'];
  if (!status || !validStatuses.includes(status)) {
    res.status(400).json({ message: 'Invalid status' });
    return;
  }

  // Build update fields based on status
  const updates: string[] = ['status = $1'];
  const values: unknown[] = [status];
  let idx = 2;

  if (status === 'viewed') {
    updates.push(`viewed_at = $${idx}`);
    values.push(new Date());
    idx++;
  } else if (status === 'shortlisted') {
    updates.push(`shortlisted_at = $${idx}`);
    values.push(new Date());
    idx++;
  } else if (status === 'rejected') {
    updates.push(`rejected_at = $${idx}`);
    values.push(new Date());
    idx++;
    if (reason) {
      updates.push(`rejection_reason = $${idx}`);
      values.push(reason);
      idx++;
    }
  } else if (status === 'hired') {
    updates.push(`hired_at = $${idx}`);
    values.push(new Date());
    idx++;
    if (attributedToPlatform !== undefined) {
      updates.push(`attributed_to_platform = $${idx}`);
      values.push(attributedToPlatform);
      idx++;
    }
    if (joiningDate) {
      updates.push(`joining_date = $${idx}`);
      values.push(joiningDate);
      idx++;
    }
  }

  values.push(applicationId);
  const result = await pool.query(
    `UPDATE applications SET ${updates.join(', ')} WHERE id = $${idx} RETURNING *`,
    values
  );

  if (result.rows.length === 0) {
    res.status(404).json({ message: 'Application not found' });
    return;
  }

  // If hired, increment filled_count on the job
  if (status === 'hired') {
    await pool.query(
      'UPDATE jobs SET filled_count = filled_count + 1 WHERE id = $1',
      [result.rows[0].job_id]
    );
  }

  res.json(toCamelCase(result.rows[0]));
}
