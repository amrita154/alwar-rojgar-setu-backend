import { pool } from '../config/database';
import { toCamelCase } from '../utils';

const ALLOWED_UPDATE_FIELDS: Record<string, string> = {
  fullName: 'full_name',
  email: 'email',
  highestEducation: 'highest_education',
  itiTrade: 'iti_trade',
  itiCollege: 'iti_college',
  department: 'department',
  graduationYear: 'graduation_year',
  workExperienceMonths: 'work_experience_months',
  expectedSalary: 'expected_salary',
  skills: 'skills',
  city: 'city',
  district: 'district',
  pincode: 'pincode',
};

export async function getProfileByUserId(userId: string) {
  const result = await pool.query('SELECT * FROM candidate_profiles WHERE user_id = $1', [userId]);
  return result.rows.length > 0 ? result.rows[0] : null;
}

export async function getProfileId(userId: string): Promise<string | null> {
  const result = await pool.query('SELECT id FROM candidate_profiles WHERE user_id = $1', [userId]);
  return result.rows.length > 0 ? result.rows[0].id : null;
}

export async function createProfile(userId: string, data: Record<string, unknown>) {
  const {
    fullName, email, highestEducation, itiTrade, itiCollege, department,
    graduationYear, workExperienceMonths, expectedSalary, skills,
    city, district, pincode,
  } = data;

  const result = await pool.query(
    `INSERT INTO candidate_profiles
      (user_id, full_name, email, highest_education, iti_trade, iti_college, department,
       graduation_year, work_experience_months, expected_salary, skills, city, district, pincode)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
    RETURNING *`,
    [userId, fullName, email || null, highestEducation || null, itiTrade || null,
     itiCollege || null, department || null, graduationYear || null,
     workExperienceMonths || null, expectedSalary || null, skills || null,
     city || null, district || null, pincode || null]
  );

  return toCamelCase(result.rows[0]);
}

export async function updateProfile(userId: string, data: Record<string, unknown>) {
  const fields: string[] = [];
  const values: unknown[] = [];
  let idx = 1;

  for (const [camelKey, dbKey] of Object.entries(ALLOWED_UPDATE_FIELDS)) {
    if (data[camelKey] !== undefined) {
      fields.push(`${dbKey} = $${idx}`);
      values.push(data[camelKey]);
      idx++;
    }
  }

  if (fields.length === 0) return null;

  values.push(userId);
  const result = await pool.query(
    `UPDATE candidate_profiles SET ${fields.join(', ')} WHERE user_id = $${idx} RETURNING *`,
    values
  );

  return result.rows.length > 0 ? toCamelCase(result.rows[0]) : null;
}

export async function setFileUrl(userId: string, column: string, fileUrl: string) {
  const result = await pool.query(
    `UPDATE candidate_profiles SET ${column} = $1 WHERE user_id = $2 RETURNING *`,
    [fileUrl, userId]
  );
  return result.rows.length > 0 ? toCamelCase(result.rows[0]) : null;
}

export async function getApplications(
  candidateId: string,
  filters: { status?: string; limit: number; offset: number }
) {
  let where = 'WHERE a.candidate_id = $1';
  const params: unknown[] = [candidateId];

  if (filters.status) {
    params.push(filters.status);
    where += ` AND a.status = $${params.length}`;
  }

  const countResult = await pool.query(
    `SELECT COUNT(*) FROM applications a ${where}`, params
  );
  const total = parseInt(countResult.rows[0].count, 10);

  params.push(filters.limit, filters.offset);
  const result = await pool.query(
    `SELECT a.*, row_to_json(j.*) as job
     FROM applications a
     LEFT JOIN jobs j ON j.id = a.job_id
     ${where}
     ORDER BY a.created_at DESC
     LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  );

  const data = result.rows.map((row) => {
    const { job, ...app } = row;
    return { ...toCamelCase(app), job: job ? toCamelCase(job) : null };
  });

  return { data, total };
}
