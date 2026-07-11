import { pool } from '../config/database';
import { toCamelCase } from '../utils';

export async function search(filters: {
  q?: string;
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

  if (filters.q) {
    // Free-text keyword search across title, skill/trade, company and description.
    // Parameterized + ILIKE (escape LIKE wildcards) to stay injection-safe.
    const term = `%${filters.q.replace(/[%_\\]/g, (m) => `\\${m}`)}%`;
    params.push(term);
    const idx = params.length;
    where += ` AND (j.title ILIKE $${idx} OR j.trade_required ILIKE $${idx} OR j.description ILIKE $${idx} OR ep.company_name ILIKE $${idx})`;
  }
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

  const countResult = await pool.query(
    `SELECT COUNT(*) FROM jobs j LEFT JOIN employer_profiles ep ON ep.id = j.employer_id ${where}`,
    params
  );
  const total = parseInt(countResult.rows[0].count, 10);

  params.push(filters.limit, filters.offset);
  const result = await pool.query(
    `SELECT j.*, ep.company_name, ep.logo_url as company_logo_url, ep.description as company_description
     FROM jobs j
     LEFT JOIN employer_profiles ep ON ep.id = j.employer_id
     ${where}
     ORDER BY j.posted_at DESC
     LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  );

  return { data: result.rows.map(toCamelCase), total };
}

/**
 * Score a single active job against a candidate profile row by overlapping
 * skills. Higher score = better match. Signals:
 *  - each candidate skill / ITI trade that appears in the job's title,
 *    description or required trade → +1
 *  - candidate's ITI trade exactly equals the job's required trade → +3
 *  - job is in the candidate's district (only when there is already an overlap)
 *    → +1 (convenience boost, never the sole reason to recommend)
 */
function scoreJobForCandidate(
  profile: { skills?: unknown; iti_trade?: string | null; district?: string | null },
  job: { title?: string | null; description?: string | null; trade_required?: string | null; district?: string | null }
): { matchScore: number; matchedSkills: string[] } {
  const terms: string[] = [];
  if (Array.isArray(profile.skills)) terms.push(...(profile.skills as string[]));
  if (profile.iti_trade) terms.push(profile.iti_trade);

  const haystack = [job.title, job.description, job.trade_required]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  const matchedSkills: string[] = [];
  let matchScore = 0;

  for (const raw of terms) {
    const term = String(raw).trim();
    if (!term) continue;
    if (haystack.includes(term.toLowerCase())) {
      if (!matchedSkills.includes(term)) matchedSkills.push(term);
      matchScore += 1;
    }
  }

  if (
    profile.iti_trade &&
    job.trade_required &&
    String(profile.iti_trade).toLowerCase() === String(job.trade_required).toLowerCase()
  ) {
    matchScore += 3;
  }

  if (
    matchScore > 0 &&
    profile.district &&
    job.district &&
    String(profile.district).toLowerCase() === String(job.district).toLowerCase()
  ) {
    matchScore += 1;
  }

  return { matchScore, matchedSkills };
}

/**
 * Recommend active jobs for a candidate, ranked by skill overlap.
 * Returns only jobs with at least one matching skill/trade.
 */
export async function getRecommended(userId: string, limit = 8) {
  const profileResult = await pool.query(
    'SELECT skills, iti_trade, district FROM candidate_profiles WHERE user_id = $1',
    [userId]
  );
  if (profileResult.rows.length === 0) return [];
  const profile = profileResult.rows[0];

  const hasSignals =
    (Array.isArray(profile.skills) && profile.skills.length > 0) || Boolean(profile.iti_trade);
  if (!hasSignals) return [];

  const jobsResult = await pool.query(
    `SELECT j.*, ep.company_name, ep.logo_url as company_logo_url, ep.description as company_description
     FROM jobs j
     LEFT JOIN employer_profiles ep ON ep.id = j.employer_id
     WHERE j.status = 'active'
     ORDER BY j.posted_at DESC
     LIMIT 200`
  );

  return jobsResult.rows
    .map((row) => ({ row, ...scoreJobForCandidate(profile, row) }))
    .filter((r) => r.matchScore > 0)
    .sort((a, b) => b.matchScore - a.matchScore)
    .slice(0, limit)
    .map((r) => ({ ...toCamelCase(r.row), matchScore: r.matchScore, matchedSkills: r.matchedSkills }));
}

export async function getById(jobId: string) {
  const result = await pool.query(
    `SELECT j.*, ep.company_name, ep.logo_url as company_logo_url, ep.description as company_description
     FROM jobs j
     LEFT JOIN employer_profiles ep ON ep.id = j.employer_id
     WHERE j.id = $1`,
    [jobId]
  );
  return result.rows.length > 0 ? toCamelCase(result.rows[0]) : null;
}

export async function getOwned(employerId: string) {
  const result = await pool.query(
    `SELECT j.*, ep.company_name, ep.logo_url as company_logo_url, ep.description as company_description
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
    [employerId, title, description, grossSalary, netSalary ?? null, jobType, openings || 1, tradeRequired || null, district]
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

export async function reopen(jobId: string, employerId: string) {
  const result = await pool.query(
    `UPDATE jobs SET status = 'active', posted_at = NOW() WHERE id = $1 AND employer_id = $2 RETURNING *`,
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
