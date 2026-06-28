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

export async function createEmployerProfile(req: AuthRequest, res: Response): Promise<void> {
  const userId = req.user!.userId;

  const existing = await pool.query('SELECT id FROM employer_profiles WHERE user_id = $1', [userId]);
  if (existing.rows.length > 0) {
    res.status(409).json({ message: 'Profile already exists' });
    return;
  }

  const { companyName, gstNumber, udyamNumber } = req.body;
  if (!companyName) {
    res.status(400).json({ message: 'Company name is required' });
    return;
  }

  const result = await pool.query(
    `INSERT INTO employer_profiles (user_id, company_name, gst_number, udyam_number)
     VALUES ($1, $2, $3, $4) RETURNING *`,
    [userId, companyName, gstNumber || null, udyamNumber || null]
  );

  res.status(201).json(toCamelCase(result.rows[0]));
}

export async function getEmployerProfile(req: AuthRequest, res: Response): Promise<void> {
  const userId = req.user!.userId;

  const result = await pool.query('SELECT * FROM employer_profiles WHERE user_id = $1', [userId]);
  if (result.rows.length === 0) {
    res.status(404).json({ message: 'Profile not found' });
    return;
  }

  res.json(toCamelCase(result.rows[0]));
}

export async function updateEmployerProfile(req: AuthRequest, res: Response): Promise<void> {
  const userId = req.user!.userId;

  const fields: string[] = [];
  const values: unknown[] = [];
  let idx = 1;

  const allowedFields: Record<string, string> = {
    companyName: 'company_name',
    gstNumber: 'gst_number',
    udyamNumber: 'udyam_number',
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
    `UPDATE employer_profiles SET ${fields.join(', ')} WHERE user_id = $${idx} RETURNING *`,
    values
  );

  if (result.rows.length === 0) {
    res.status(404).json({ message: 'Profile not found' });
    return;
  }

  res.json(toCamelCase(result.rows[0]));
}

export async function getEmployerDocuments(req: AuthRequest, res: Response): Promise<void> {
  const userId = req.user!.userId;

  const profile = await pool.query('SELECT id FROM employer_profiles WHERE user_id = $1', [userId]);
  if (profile.rows.length === 0) {
    res.status(404).json({ message: 'Profile not found' });
    return;
  }

  const result = await pool.query(
    'SELECT * FROM employer_documents WHERE employer_id = $1 ORDER BY uploaded_at DESC',
    [profile.rows[0].id]
  );

  res.json(result.rows.map(toCamelCase));
}

export async function uploadEmployerDocument(req: AuthRequest, res: Response): Promise<void> {
  const userId = req.user!.userId;

  if (!req.file) {
    res.status(400).json({ message: 'File is required' });
    return;
  }

  const { documentType } = req.body;
  const validTypes = ['GST_CERTIFICATE', 'UDYAM_CERTIFICATE', 'FACTORY_LICENSE', 'PAN_CARD', 'OTHER'];
  if (!validTypes.includes(documentType)) {
    res.status(400).json({ message: 'Invalid document type' });
    return;
  }

  const profile = await pool.query('SELECT id FROM employer_profiles WHERE user_id = $1', [userId]);
  if (profile.rows.length === 0) {
    res.status(404).json({ message: 'Profile not found. Create profile first.' });
    return;
  }

  const fileUrl = `/uploads/${req.file.filename}`;
  const result = await pool.query(
    `INSERT INTO employer_documents (employer_id, document_type, document_url)
     VALUES ($1, $2, $3) RETURNING *`,
    [profile.rows[0].id, documentType, fileUrl]
  );

  res.status(201).json(toCamelCase(result.rows[0]));
}

export async function deleteEmployerDocument(req: AuthRequest, res: Response): Promise<void> {
  const userId = req.user!.userId;
  const { documentId } = req.params;

  const profile = await pool.query('SELECT id FROM employer_profiles WHERE user_id = $1', [userId]);
  if (profile.rows.length === 0) {
    res.status(404).json({ message: 'Profile not found' });
    return;
  }

  const result = await pool.query(
    'DELETE FROM employer_documents WHERE id = $1 AND employer_id = $2 RETURNING id',
    [documentId, profile.rows[0].id]
  );

  if (result.rows.length === 0) {
    res.status(404).json({ message: 'Document not found' });
    return;
  }

  res.status(204).send();
}
