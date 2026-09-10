import { pool } from '../config/database';
import { config } from '../config';
import { toCamelCase } from '../utils';

export async function getDashboardMetrics() {
  const [candidates, employers, pendingEmployers, activeJobs, totalApplications, totalPlacements, verifiedPlacements] =
    await Promise.all([
      pool.query('SELECT COUNT(*) FROM candidate_profiles'),
      pool.query('SELECT COUNT(*) FROM employer_profiles'),
      pool.query("SELECT COUNT(*) FROM employer_profiles WHERE status = 'pending'"),
      pool.query("SELECT COUNT(*) FROM jobs WHERE status = 'active'"),
      pool.query('SELECT COUNT(*) FROM applications'),
      pool.query("SELECT COUNT(*) FROM applications WHERE status = 'hired'"),
      pool.query("SELECT COUNT(*) FROM applications WHERE status = 'hired' AND attributed_to_platform = true"),
    ]);

  const registrationsByMonth = await pool.query(`
    SELECT to_char(created_at, 'YYYY-MM') as month, COUNT(*) as count
    FROM users WHERE role IN ('candidate', 'employer')
    AND created_at > NOW() - INTERVAL '6 months'
    GROUP BY month ORDER BY month
  `);

  const placementsByMonth = await pool.query(`
    SELECT to_char(hired_at, 'YYYY-MM') as month, COUNT(*) as count
    FROM applications WHERE status = 'hired' AND hired_at IS NOT NULL
    AND hired_at > NOW() - INTERVAL '6 months'
    GROUP BY month ORDER BY month
  `);

  const applicationsByStatus = await pool.query(
    'SELECT status, COUNT(*) as count FROM applications GROUP BY status'
  );

  const jobsByEmployer = await pool.query(`
    SELECT ep.company_name, COUNT(j.id) as count
    FROM employer_profiles ep
    JOIN jobs j ON j.employer_id = ep.id
    GROUP BY ep.id, ep.company_name
    ORDER BY count DESC
    LIMIT 10
  `);

  const rejectionsByEmployer = await pool.query(`
    SELECT ep.company_name, COUNT(a.id) as count
    FROM applications a
    JOIN jobs j ON j.id = a.job_id
    JOIN employer_profiles ep ON ep.id = j.employer_id
    WHERE a.status = 'rejected'
    GROUP BY ep.id, ep.company_name
    ORDER BY count DESC
    LIMIT 10
  `);

  const hiredByGender = await pool.query(`
    SELECT COALESCE(cp.gender, 'not_specified') as gender, COUNT(a.id) as count
    FROM applications a
    JOIN candidate_profiles cp ON cp.id = a.candidate_id
    WHERE a.status = 'hired'
    GROUP BY cp.gender
    ORDER BY count DESC
  `);

  return {
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
    jobsByEmployer: jobsByEmployer.rows.map(r => ({ companyName: r.company_name, count: parseInt(r.count, 10) })),
    rejectionsByEmployer: rejectionsByEmployer.rows.map(r => ({ companyName: r.company_name, count: parseInt(r.count, 10) })),
    hiredByGender: hiredByGender.rows.map(r => ({ gender: r.gender, count: parseInt(r.count, 10) })),
  };
}

export async function listEmployers(filters: { status?: string; search?: string; limit: number; offset: number }) {
  let where = 'WHERE 1=1';
  const params: unknown[] = [];

  if (filters.status) {
    params.push(filters.status);
    where += ` AND ep.status = $${params.length}`;
  }
  if (filters.search) {
    params.push(`%${filters.search}%`);
    where += ` AND ep.company_name ILIKE $${params.length}`;
  }

  const countResult = await pool.query(`SELECT COUNT(*) FROM employer_profiles ep ${where}`, params);
  const total = parseInt(countResult.rows[0].count, 10);

  params.push(filters.limit, filters.offset);
  const result = await pool.query(
    `SELECT ep.*, u.is_active FROM employer_profiles ep
     JOIN users u ON u.id = ep.user_id
     ${where} ORDER BY ep.created_at DESC
     LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  );

  return { data: result.rows.map(toCamelCase), total };
}

export async function getEmployerById(employerId: string) {
  const result = await pool.query(
    `SELECT ep.*, u.is_active FROM employer_profiles ep
     JOIN users u ON u.id = ep.user_id WHERE ep.id = $1`,
    [employerId]
  );
  return result.rows.length > 0 ? toCamelCase(result.rows[0]) : null;
}

export async function setEmployerVerification(employerId: string, adminId: string, status: string, reason?: string) {
  const updates = ['status = $1', 'verified_by = $2', 'verified_at = $3'];
  const values: unknown[] = [status, adminId, new Date()];

  if (status === 'rejected' && reason) {
    updates.push(`rejection_reason = $${values.length + 1}`);
    values.push(reason);
  }

  values.push(employerId);
  const result = await pool.query(
    `UPDATE employer_profiles SET ${updates.join(', ')} WHERE id = $${values.length} RETURNING *`,
    values
  );

  return result.rows.length > 0 ? toCamelCase(result.rows[0]) : null;
}

export async function listCandidates(filters: { search?: string; trade?: string; limit: number; offset: number }) {
  let where = 'WHERE 1=1';
  const params: unknown[] = [];

  if (filters.search) {
    params.push(`%${filters.search}%`);
    where += ` AND cp.full_name ILIKE $${params.length}`;
  }
  if (filters.trade) {
    params.push(filters.trade);
    where += ` AND cp.iti_trade = $${params.length}`;
  }

  const countResult = await pool.query(`SELECT COUNT(*) FROM candidate_profiles cp ${where}`, params);
  const total = parseInt(countResult.rows[0].count, 10);

  params.push(filters.limit, filters.offset);
  const result = await pool.query(
    `SELECT cp.*, u.is_active FROM candidate_profiles cp
     JOIN users u ON u.id = cp.user_id
     ${where} ORDER BY cp.created_at DESC
     LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  );

  return { data: result.rows.map(toCamelCase), total };
}

export async function getCandidateById(candidateId: string) {
  const result = await pool.query(
    `SELECT cp.*, u.is_active FROM candidate_profiles cp
     JOIN users u ON u.id = cp.user_id WHERE cp.id = $1`,
    [candidateId]
  );
  return result.rows.length > 0 ? toCamelCase(result.rows[0]) : null;
}

export async function setUserActive(userId: string, active: boolean): Promise<boolean> {
  const result = await pool.query(
    'UPDATE users SET is_active = $1 WHERE id = $2 RETURNING id',
    [active, userId]
  );
  return result.rows.length > 0;
}

/** List current admins — every admin from here on is active/approved by construction. */
export async function listAdmins(filters: { search?: string; limit: number; offset: number }) {
  let where = "WHERE u.role = 'admin'";
  const params: unknown[] = [];

  if (filters.search) {
    params.push(`%${filters.search}%`);
    where += ` AND (u.name ILIKE $${params.length} OR u.email ILIKE $${params.length})`;
  }

  const countResult = await pool.query(`SELECT COUNT(*) FROM users u ${where}`, params);
  const total = parseInt(countResult.rows[0].count, 10);

  params.push(filters.limit, filters.offset);
  const result = await pool.query(
    `SELECT id AS user_id, name, email, admin_status, is_active, created_at
     FROM users u ${where}
     ORDER BY created_at DESC
     LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  );

  return { data: result.rows.map(toCamelCase), total };
}

/**
 * Check whether an email should become an admin the moment its account is
 * created — either it's a bootstrap super-admin (env whitelist) or an
 * existing admin invited it via grantAdminAccess.
 */
export async function checkAdminGrant(email: string): Promise<boolean> {
  const normalized = email.toLowerCase().trim();
  if (config.admin.superAdminEmails.includes(normalized)) return true;
  const result = await pool.query('SELECT 1 FROM admin_invites WHERE email = $1', [normalized]);
  return result.rows.length > 0;
}

/** Consume (delete) a pending invite once the invited email's account is created. Safe to call even if none exists. */
export async function consumeAdminInvite(email: string): Promise<void> {
  await pool.query('DELETE FROM admin_invites WHERE email = $1', [email.toLowerCase().trim()]);
}

export async function promoteUserToAdmin(userId: string): Promise<Record<string, unknown>> {
  const result = await pool.query(
    `UPDATE users SET role = 'admin', admin_status = 'approved', is_active = true, updated_at = NOW()
     WHERE id = $1
     RETURNING id AS user_id, name, email, admin_status, is_active, created_at`,
    [userId]
  );
  if (result.rows.length === 0) {
    throw Object.assign(new Error('User not found'), { statusCode: 404 });
  }
  return toCamelCase(result.rows[0]);
}

/**
 * Grant admin access by email. If the email already has an account, it's
 * promoted immediately. Otherwise an invite is stored and consumed the
 * moment that email registers (see checkAdminGrant / consumeAdminInvite).
 */
export async function grantAdminAccess(
  email: string,
  invitedBy: string
): Promise<{ kind: 'promoted'; user: Record<string, unknown> } | { kind: 'invited'; invite: Record<string, unknown> }> {
  const normalized = email.toLowerCase().trim();

  const existing = await pool.query('SELECT id, role FROM users WHERE email = $1', [normalized]);
  if (existing.rows.length > 0) {
    if (existing.rows[0].role === 'admin') {
      throw Object.assign(new Error('This user is already an admin'), { statusCode: 409 });
    }
    return { kind: 'promoted', user: await promoteUserToAdmin(existing.rows[0].id) };
  }

  const result = await pool.query(
    `INSERT INTO admin_invites (email, invited_by) VALUES ($1, $2)
     ON CONFLICT (email) DO UPDATE SET invited_by = EXCLUDED.invited_by
     RETURNING *`,
    [normalized, invitedBy]
  );
  return { kind: 'invited', invite: toCamelCase(result.rows[0]) };
}

export async function listAdminInvites(): Promise<Record<string, unknown>[]> {
  const result = await pool.query(
    `SELECT ai.id, ai.email, ai.created_at, u.name AS invited_by_name, u.email AS invited_by_email
     FROM admin_invites ai
     LEFT JOIN users u ON u.id = ai.invited_by
     ORDER BY ai.created_at DESC`
  );
  return result.rows.map(toCamelCase);
}

export async function cancelAdminInvite(id: string): Promise<boolean> {
  const result = await pool.query('DELETE FROM admin_invites WHERE id = $1', [id]);
  return (result.rowCount ?? 0) > 0;
}

