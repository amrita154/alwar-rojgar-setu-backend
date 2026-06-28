import { Response } from 'express';
import path from 'path';
import { AuthRequest } from '../middleware/auth';
import { config } from '../config';
import { pool } from '../config/database';

const CANDIDATE_FILE_COLUMNS = [
  'photo_url',
  'resume_url',
  'aadhaar_url',
  'iti_certificate_url',
  'diploma_certificate_url',
  'degree_certificate_url',
  'experience_letter_url',
];

export async function serveDocument(req: AuthRequest, res: Response): Promise<void> {
  const { filename } = req.params;

  // Prevent path traversal
  if (filename.includes('/') || filename.includes('..')) {
    res.status(400).json({ message: 'Invalid filename' });
    return;
  }

  const fileUrl = `/uploads/${filename}`;
  const requesterId = req.user!.userId;
  const requesterRole = req.user!.role;

  // Check candidate files
  const colChecks = CANDIDATE_FILE_COLUMNS.map((col) => `${col} = $1`).join(' OR ');
  const candidateResult = await pool.query(
    `SELECT user_id FROM candidate_profiles WHERE ${colChecks}`,
    [fileUrl]
  );

  if (candidateResult.rows.length > 0) {
    const ownerUserId: string = candidateResult.rows[0].user_id;
    const isOwner = ownerUserId === requesterId;
    const isAdmin = requesterRole === 'admin';

    if (!isOwner && !isAdmin) {
      if (requesterRole === 'employer') {
        // Allow if employer has at least one application from this candidate
        const appResult = await pool.query(
          `SELECT a.id FROM applications a
           JOIN candidate_profiles cp ON cp.id = a.candidate_id
           JOIN jobs j ON j.id = a.job_id
           JOIN employer_profiles ep ON ep.id = j.employer_id
           WHERE cp.user_id = $1 AND ep.user_id = $2
           LIMIT 1`,
          [ownerUserId, requesterId]
        );
        if (appResult.rows.length === 0) {
          res.status(403).json({ message: 'Forbidden' });
          return;
        }
      } else {
        res.status(403).json({ message: 'Forbidden' });
        return;
      }
    }

    res.sendFile(path.join(config.upload.dir, filename));
    return;
  }

  // Check employer documents
  const employerDocResult = await pool.query(
    `SELECT ep.user_id FROM employer_documents ed
     JOIN employer_profiles ep ON ep.id = ed.employer_id
     WHERE ed.document_url = $1`,
    [fileUrl]
  );

  if (employerDocResult.rows.length > 0) {
    const ownerUserId: string = employerDocResult.rows[0].user_id;
    const isOwner = ownerUserId === requesterId;
    const isAdmin = requesterRole === 'admin';

    if (!isOwner && !isAdmin) {
      res.status(403).json({ message: 'Forbidden' });
      return;
    }

    res.sendFile(path.join(config.upload.dir, filename));
    return;
  }

  res.status(404).json({ message: 'File not found' });
}
