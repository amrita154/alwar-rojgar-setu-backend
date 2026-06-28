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

export async function createCandidateProfile(req: AuthRequest, res: Response): Promise<void> {
  const userId = req.user!.userId;

  const existing = await pool.query('SELECT id FROM candidate_profiles WHERE user_id = $1', [userId]);
  if (existing.rows.length > 0) {
    res.status(409).json({ message: 'Profile already exists' });
    return;
  }

  const {
    fullName, email, highestEducation, itiTrade, itiCollege, department,
    graduationYear, workExperienceMonths, expectedSalary, skills,
    city, district, pincode,
  } = req.body;

  if (!fullName) {
    res.status(400).json({ message: 'Full name is required' });
    return;
  }

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

  res.status(201).json(toCamelCase(result.rows[0]));
}

export async function getCandidateProfile(req: AuthRequest, res: Response): Promise<void> {
  const userId = req.user!.userId;

  const result = await pool.query('SELECT * FROM candidate_profiles WHERE user_id = $1', [userId]);
  if (result.rows.length === 0) {
    res.status(404).json({ message: 'Profile not found' });
    return;
  }

  res.json(toCamelCase(result.rows[0]));
}

export async function updateCandidateProfile(req: AuthRequest, res: Response): Promise<void> {
  const userId = req.user!.userId;

  const fields: string[] = [];
  const values: unknown[] = [];
  let idx = 1;

  const allowedFields: Record<string, string> = {
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

  values.push(userId);
  const result = await pool.query(
    `UPDATE candidate_profiles SET ${fields.join(', ')} WHERE user_id = $${idx} RETURNING *`,
    values
  );

  if (result.rows.length === 0) {
    res.status(404).json({ message: 'Profile not found' });
    return;
  }

  res.json(toCamelCase(result.rows[0]));
}

export async function uploadResume(req: AuthRequest, res: Response): Promise<void> {
  const userId = req.user!.userId;
  if (!req.file) {
    res.status(400).json({ message: 'File is required' });
    return;
  }

  const fileUrl = `/uploads/${req.file.filename}`;
  const result = await pool.query(
    'UPDATE candidate_profiles SET resume_url = $1 WHERE user_id = $2 RETURNING *',
    [fileUrl, userId]
  );

  if (result.rows.length === 0) {
    res.status(404).json({ message: 'Profile not found. Create profile first.' });
    return;
  }

  res.json(toCamelCase(result.rows[0]));
}

export async function uploadAadhaar(req: AuthRequest, res: Response): Promise<void> {
  const userId = req.user!.userId;
  if (!req.file) {
    res.status(400).json({ message: 'File is required' });
    return;
  }

  const fileUrl = `/uploads/${req.file.filename}`;
  const result = await pool.query(
    'UPDATE candidate_profiles SET aadhaar_url = $1 WHERE user_id = $2 RETURNING *',
    [fileUrl, userId]
  );

  if (result.rows.length === 0) {
    res.status(404).json({ message: 'Profile not found. Create profile first.' });
    return;
  }

  res.json(toCamelCase(result.rows[0]));
}

export async function uploadCertificate(req: AuthRequest, res: Response): Promise<void> {
  const userId = req.user!.userId;
  if (!req.file) {
    res.status(400).json({ message: 'File is required' });
    return;
  }

  const { documentType } = req.body;
  const columnMap: Record<string, string> = {
    ITI_CERTIFICATE: 'iti_certificate_url',
    DIPLOMA_CERTIFICATE: 'diploma_certificate_url',
    DEGREE_CERTIFICATE: 'degree_certificate_url',
    EXPERIENCE_LETTER: 'experience_letter_url',
  };

  const column = columnMap[documentType];
  if (!column) {
    res.status(400).json({ message: 'Invalid documentType' });
    return;
  }

  const fileUrl = `/uploads/${req.file.filename}`;
  const result = await pool.query(
    `UPDATE candidate_profiles SET ${column} = $1 WHERE user_id = $2 RETURNING *`,
    [fileUrl, userId]
  );

  if (result.rows.length === 0) {
    res.status(404).json({ message: 'Profile not found. Create profile first.' });
    return;
  }

  res.json(toCamelCase(result.rows[0]));
}

export async function getCandidateApplications(req: AuthRequest, res: Response): Promise<void> {
  const userId = req.user!.userId;

  const profileResult = await pool.query(
    'SELECT id FROM candidate_profiles WHERE user_id = $1', [userId]
  );
  if (profileResult.rows.length === 0) {
    res.status(404).json({ message: 'Profile not found' });
    return;
  }

  const candidateId = profileResult.rows[0].id;
  const { status, page = '1', limit = '10' } = req.query;
  const pageNum = Math.max(1, parseInt(page as string, 10));
  const limitNum = Math.min(50, Math.max(1, parseInt(limit as string, 10)));
  const offset = (pageNum - 1) * limitNum;

  let where = 'WHERE a.candidate_id = $1';
  const params: unknown[] = [candidateId];

  if (status) {
    params.push(status);
    where += ` AND a.status = $${params.length}`;
  }

  const countResult = await pool.query(
    `SELECT COUNT(*) FROM applications a ${where}`, params
  );
  const total = parseInt(countResult.rows[0].count, 10);

  params.push(limitNum, offset);
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

  res.json({
    data,
    page: pageNum,
    limit: limitNum,
    total,
    totalPages: Math.ceil(total / limitNum),
  });
}
