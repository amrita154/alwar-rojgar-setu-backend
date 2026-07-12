import { pool } from '../config/database';
import { toCamelCase } from '../utils';

export async function getProfileByUserId(userId: string) {
  const result = await pool.query('SELECT * FROM employer_profiles WHERE user_id = $1', [userId]);
  return result.rows.length > 0 ? result.rows[0] : null;
}

export async function getProfileId(userId: string): Promise<string | null> {
  const result = await pool.query('SELECT id FROM employer_profiles WHERE user_id = $1', [userId]);
  return result.rows.length > 0 ? result.rows[0].id : null;
}

export async function createProfile(userId: string, data: Record<string, unknown>) {
  const {
    companyName, gstNumber, udyamNumber, logoUrl, description,
    contactPersonName, contactPersonPhone, contactPersonEmail, contactPersonDesignation,
  } = data;

  const result = await pool.query(
    `INSERT INTO employer_profiles
      (user_id, company_name, gst_number, udyam_number, logo_url, description,
       contact_person_name, contact_person_phone, contact_person_email, contact_person_designation)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
    [userId, companyName, gstNumber || null, udyamNumber || null, logoUrl || null, description || null,
     contactPersonName || null, contactPersonPhone || null, contactPersonEmail || null, contactPersonDesignation || null]
  );

  return toCamelCase(result.rows[0]);
}

export async function updateProfile(userId: string, data: Record<string, unknown>) {
  const allowedFields: Record<string, string> = {
    companyName: 'company_name',
    gstNumber: 'gst_number',
    udyamNumber: 'udyam_number',
    logoUrl: 'logo_url',
    description: 'description',
    contactPersonName: 'contact_person_name',
    contactPersonPhone: 'contact_person_phone',
    contactPersonDesignation: 'contact_person_designation',
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

  values.push(userId);
  const result = await pool.query(
    `UPDATE employer_profiles SET ${fields.join(', ')} WHERE user_id = $${idx} RETURNING *`,
    values
  );

  return result.rows.length > 0 ? toCamelCase(result.rows[0]) : null;
}

export async function getDocuments(employerId: string) {
  const result = await pool.query(
    'SELECT * FROM employer_documents WHERE employer_id = $1 ORDER BY uploaded_at DESC',
    [employerId]
  );
  return result.rows.map(toCamelCase);
}

export async function addDocument(employerId: string, documentType: string, fileUrl: string) {
  const result = await pool.query(
    `INSERT INTO employer_documents (employer_id, document_type, document_url)
     VALUES ($1, $2, $3) RETURNING *`,
    [employerId, documentType, fileUrl]
  );
  return toCamelCase(result.rows[0]);
}

export async function removeDocument(documentId: string, employerId: string): Promise<boolean> {
  const result = await pool.query(
    'DELETE FROM employer_documents WHERE id = $1 AND employer_id = $2 RETURNING id',
    [documentId, employerId]
  );
  return result.rows.length > 0;
}
