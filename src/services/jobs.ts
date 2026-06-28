import { pool } from '../config/database';
import { toCamelCase } from '../utils';

export async function search(filters: {
  district?: string;
  tradeRequired?: string;
  jobType?: string;
  minSalary?: number;
  maxSalary?: number;
  limit: number;
  offset: number;
}) {
  let where = "WHERE j.status = 'active'";
  const params: unknown[] = [];

  if (filters.district) {
    params.push(filters.district);
    where += ` AND j.district = $${params.length}`;
  }
  if (filters.tradeRequired) {
    params.push(filters.tradeRequired);
    where += ` AND j.trade_required = $${params.length}`;
  }
  if (filters.jobType) {
    params.push(filters.jobType);
    where += ` AND j.job_type = $${params.length}`;
  }
  if (filters.minSalary) {
    params.push(filters.minSalary);
    where += ` AND j.net_salary >= $${params.length}`;
  }
  if (filters.maxSalary) {
    params.push(filters.maxSalary);
    where += ` AND j.net_salary <= $${params.length}`;
  }

  const countResult = await pool.query(`SELECT COUNT(*) FROM jobs j ${where}`, params);
  const total = parseInt(countResult.rows[0].count, 10);

  params.push(filters.limit, filters.offset);
  const result = await pool.query(
    `SELECT j.*, ep.company_name
     FROM jobs j
     LEFT JOIN employer_profiles ep ON ep.id = j.employer_id
     ${where}
     ORDER BY j.posted_at DESC
     LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  );

  return { data: result.rows.map(toCamelCase), total };
}

export async function getById(jobId: string) {
  const result = await pool.query(
    `SELECT j.*, ep.company_name
     FROM jobs j
     LEFT JOIN employer_profiles ep ON ep.id = j.employer_id
     WHERE j.id = $1`,
    [jobId]
  );
  return result.rows.length > 0 ? toCamelCase(result.rows[0]) : null;
}

export async function getOwned(employerId: string) {
  const result = await pool.query(
    `SELECT j.*, ep.company_name
     FROM jobs j
     LEFT JOIN employer_profiles ep ON ep.id = j.employer_id
     WHERE j.employer_id = $1
     ORDER BY j.created_at DESC`,
    [employerId]
  );
  return result.rows.map(toCamelCase);
}

export async function create(employerId: string, data: Record<string, unknown>) {
  const { title, description, grossSalary, netSalary, jobType, openings, tradeRequired, district } = data;

  const result = await pool.query(
    `INSERT INTO jobs (employer_id, title, description, gross_salary, net_salary, job_type, openings, trade_required, district)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
    [employerId, title, description, grossSalary, netSalary, jobType, openings || 1, tradeRequired || null, district]
  );

  return toCamelCase(result.rows[0]);
}

export async function update(jobId: string, employerId: string, data: Record<string, unknown>) {
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

  const fields: string[] = [];
  const values: unknown[] = [];
  let idx = 1;

  for (const [camelKey, dbKey] of Object.entries(allowedFields)) {
    if (data[camelKey] !== undefined) {
      fields.push(`${dbKey} = $${idx}`);
      values.push(data[camelKey]);
      idx++;
    }
  }

  if (fields.length === 0) return null;

  values.push(jobId, employerId);
  const result = await pool.query(
    `UPDATE jobs SET ${fields.join(', ')} WHERE id = $${idx} AND employer_id = $${idx + 1} RETURNING *`,
    values
  );

  return result.rows.length > 0 ? toCamelCase(result.rows[0]) : null;
}

export async function close(jobId: string, employerId: string) {
  const result = await pool.query(
    `UPDATE jobs SET status = 'closed' WHERE id = $1 AND employer_id = $2 RETURNING *`,
    [jobId, employerId]
  );
  return result.rows.length > 0 ? toCamelCase(result.rows[0]) : null;
}

export async function isOwnedBy(jobId: string, employerId: string): Promise<boolean> {
  const result = await pool.query(
    'SELECT id FROM jobs WHERE id = $1 AND employer_id = $2',
    [jobId, employerId]
  );
  return result.rows.length > 0;
}

export async function getApplicants(jobId: string) {
  const result = await pool.query(
    `SELECT a.*, row_to_json(cp.*) as candidate
     FROM applications a
     LEFT JOIN candidate_profiles cp ON cp.id = a.candidate_id
     WHERE a.job_id = $1
     ORDER BY a.created_at DESC`,
    [jobId]
  );

  return result.rows.map((row) => {
    const { candidate, ...app } = row;
    return { ...toCamelCase(app), candidate: candidate ? toCamelCase(candidate) : null };
  });
}
