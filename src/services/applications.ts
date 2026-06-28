import { pool } from '../config/database';
import { toCamelCase } from '../utils';

export async function apply(candidateId: string, jobId: string) {
  // Verify job is active
  const job = await pool.query("SELECT id FROM jobs WHERE id = $1 AND status = 'active'", [jobId]);
  if (job.rows.length === 0) return { error: 'Job not found or not accepting applications', statusCode: 404 };

  // Check duplicate
  const existing = await pool.query(
    'SELECT id FROM applications WHERE candidate_id = $1 AND job_id = $2',
    [candidateId, jobId]
  );
  if (existing.rows.length > 0) return { error: 'You have already applied to this job', statusCode: 409 };

  const result = await pool.query(
    'INSERT INTO applications (candidate_id, job_id) VALUES ($1, $2) RETURNING *',
    [candidateId, jobId]
  );

  return { data: toCamelCase(result.rows[0]) };
}

export async function updateStatus(
  applicationId: string,
  status: string,
  extra: { reason?: string; attributedToPlatform?: boolean; joiningDate?: string }
) {
  const updates: string[] = ['status = $1'];
  const values: unknown[] = [status];
  let idx = 2;

  const now = new Date();

  switch (status) {
    case 'viewed':
      updates.push(`viewed_at = $${idx}`);
      values.push(now);
      idx++;
      break;
    case 'shortlisted':
      updates.push(`shortlisted_at = $${idx}`);
      values.push(now);
      idx++;
      break;
    case 'rejected':
      updates.push(`rejected_at = $${idx}`);
      values.push(now);
      idx++;
      if (extra.reason) {
        updates.push(`rejection_reason = $${idx}`);
        values.push(extra.reason);
        idx++;
      }
      break;
    case 'hired':
      updates.push(`hired_at = $${idx}`);
      values.push(now);
      idx++;
      if (extra.attributedToPlatform !== undefined) {
        updates.push(`attributed_to_platform = $${idx}`);
        values.push(extra.attributedToPlatform);
        idx++;
      }
      if (extra.joiningDate) {
        updates.push(`joining_date = $${idx}`);
        values.push(extra.joiningDate);
        idx++;
      }
      break;
  }

  values.push(applicationId);
  const result = await pool.query(
    `UPDATE applications SET ${updates.join(', ')} WHERE id = $${idx} RETURNING *`,
    values
  );

  if (result.rows.length === 0) return null;

  // Increment filled_count on hire
  if (status === 'hired') {
    await pool.query(
      'UPDATE jobs SET filled_count = filled_count + 1 WHERE id = $1',
      [result.rows[0].job_id]
    );
  }

  return toCamelCase(result.rows[0]);
}
