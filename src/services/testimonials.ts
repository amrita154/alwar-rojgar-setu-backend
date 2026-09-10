import { pool } from '../config/database';
import { toCamelCase } from '../utils';

export interface TestimonialInput {
  candidateId?: string | null;
  name: string;
  photoUrl?: string | null;
  trade?: string | null;
  body: string;
  isPublished?: boolean;
  displayOrder?: number;
}

export async function listPublished() {
  const result = await pool.query(
    `SELECT * FROM testimonials WHERE is_published = true ORDER BY display_order ASC, created_at ASC`,
  );
  return result.rows.map(toCamelCase);
}

export async function listAll() {
  const result = await pool.query(
    `SELECT * FROM testimonials ORDER BY display_order ASC, created_at ASC`,
  );
  return result.rows.map(toCamelCase);
}

export async function getById(id: string) {
  const result = await pool.query(`SELECT * FROM testimonials WHERE id = $1`, [id]);
  return result.rows[0] ? toCamelCase(result.rows[0]) : null;
}

export async function create(input: TestimonialInput) {
  const result = await pool.query(
    `INSERT INTO testimonials (candidate_id, name, photo_url, trade, body, is_published, display_order)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING *`,
    [
      input.candidateId ?? null,
      input.name,
      input.photoUrl ?? null,
      input.trade ?? null,
      input.body,
      input.isPublished ?? false,
      input.displayOrder ?? 0,
    ],
  );
  return toCamelCase(result.rows[0]);
}

export async function update(id: string, input: Partial<TestimonialInput>) {
  const fields: string[] = [];
  const params: unknown[] = [];

  if (input.name !== undefined) { params.push(input.name); fields.push(`name = $${params.length}`); }
  if (input.candidateId !== undefined) { params.push(input.candidateId); fields.push(`candidate_id = $${params.length}`); }
  if (input.photoUrl !== undefined) { params.push(input.photoUrl); fields.push(`photo_url = $${params.length}`); }
  if (input.trade !== undefined) { params.push(input.trade); fields.push(`trade = $${params.length}`); }
  if (input.body !== undefined) { params.push(input.body); fields.push(`body = $${params.length}`); }
  if (input.isPublished !== undefined) { params.push(input.isPublished); fields.push(`is_published = $${params.length}`); }
  if (input.displayOrder !== undefined) { params.push(input.displayOrder); fields.push(`display_order = $${params.length}`); }

  if (fields.length === 0) return getById(id);

  params.push(id);
  const result = await pool.query(
    `UPDATE testimonials SET ${fields.join(', ')} WHERE id = $${params.length} RETURNING *`,
    params,
  );
  return result.rows[0] ? toCamelCase(result.rows[0]) : null;
}

export async function remove(id: string): Promise<boolean> {
  const result = await pool.query(`DELETE FROM testimonials WHERE id = $1`, [id]);
  return (result.rowCount ?? 0) > 0;
}
