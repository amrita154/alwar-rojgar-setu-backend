import { pool } from '../config/database';
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

export async function listCandidates(filters: { search?: string; department?: string; limit: number; offset: number }) {
  let where = 'WHERE 1=1';
  const params: unknown[] = [];

  if (filters.search) {
    params.push(`%${filters.search}%`);
    where += ` AND cp.full_name ILIKE $${params.length}`;
  }
  if (filters.department) {
    params.push(filters.department);
    where += ` AND cp.department = $${params.length}`;
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

export async function listAdmins(filters: { status?: string; search?: string; limit: number; offset: number }) {
  let where = "WHERE u.role = 'admin'";
  const params: unknown[] = [];

  if (filters.status) {
    params.push(filters.status);
    where += ` AND u.admin_status = $${params.length}`;
  }
  if (filters.search) {
    params.push(`%${filters.search}%`);
    where += ` AND (u.name ILIKE $${params.length} OR u.phone ILIKE $${params.length})`;
  }

  const countResult = await pool.query(`SELECT COUNT(*) FROM users u ${where}`, params);
  const total = parseInt(countResult.rows[0].count, 10);

  params.push(filters.limit, filters.offset);
  const result = await pool.query(
    `SELECT id AS user_id, name, phone, admin_status, is_active, created_at
     FROM users u ${where}
     ORDER BY created_at DESC
     LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  );

  return { data: result.rows.map(toCamelCase), total };
}

export async function setAdminStatus(userId: string, status: 'approved' | 'rejected'): Promise<Record<string, unknown> | null> {
  const isActive = status === 'approved';
  const result = await pool.query(
    `UPDATE users SET admin_status = $1, is_active = $2
     WHERE id = $3 AND role = 'admin' RETURNING id AS user_id, name, phone, admin_status, is_active, created_at`,
    [status, isActive, userId]
  );
  return result.rows.length > 0 ? toCamelCase(result.rows[0]) : null;
}

const E164_IN = /^\+91[6-9]\d{9}$/;

export async function createAdminRequest(name: string, phone: string): Promise<Record<string, unknown>> {
  if (!E164_IN.test(phone)) {
    throw Object.assign(new Error('Invalid phone number. Must be a valid 10-digit Indian mobile number.'), { statusCode: 400 });
  }
  const existing = await pool.query('SELECT id, admin_status FROM users WHERE phone = $1', [phone]);
  if (existing.rows.length > 0) {
    throw Object.assign(new Error('Phone already registered'), { statusCode: 409 });
  }
  const result = await pool.query(
    `INSERT INTO users (phone, role, name, admin_status, is_active)
     VALUES ($1, 'admin', $2, 'pending', false) RETURNING id AS user_id, name, phone, admin_status, is_active, created_at`,
    [phone, name]
  );
  return toCamelCase(result.rows[0]);
}
