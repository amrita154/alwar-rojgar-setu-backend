import path from 'path';
import fs from 'fs';
import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { pool } from '../config/database';
import { config } from '../config';

const CANDIDATE_FILE_COLUMNS = [
  'photo_url',
  'resume_url',
  'aadhaar_url',
  'iti_certificate_url',
  'diploma_certificate_url',
  'degree_certificate_url',
  'experience_letter_url',
];

function serveLocalOrRedirect(res: Response, storedUrl: string, filename: string): void {
  if (storedUrl.startsWith('http')) {
    res.redirect(storedUrl);
    return;
  }
  const localPath = path.join(config.upload.dir, filename);
  if (!fs.existsSync(localPath)) {
    res.status(404).json({ message: 'File not found' });
    return;
  }
  res.sendFile(localPath);
}

export async function serveDocument(req: AuthRequest, res: Response): Promise<void> {
  const { filename } = req.params;

  if (filename.includes('/') || filename.includes('..')) {
    res.status(400).json({ message: 'Invalid filename' });
    return;
  }

  // Support both legacy `/uploads/uuid.ext` paths and bare `uuid.ext` lookups
  const legacyUrl = `/uploads/${filename}`;
  const requesterId = req.user!.userId;
  const requesterRole = req.user!.role;

  const colChecks = CANDIDATE_FILE_COLUMNS.map((col) => `(${col} = $1 OR ${col} LIKE $2)`).join(' OR ');
  const candidateResult = await pool.query(
    `SELECT user_id, ${CANDIDATE_FILE_COLUMNS.join(', ')} FROM candidate_profiles WHERE ${colChecks}`,
    [legacyUrl, `%${filename}`]
  );

  if (candidateResult.rows.length > 0) {
    const row = candidateResult.rows[0];
    const ownerUserId: string = row.user_id;
    const isOwner = ownerUserId === requesterId;
    const isAdmin = requesterRole === 'admin';

    if (!isOwner && !isAdmin) {
      if (requesterRole === 'employer') {
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

    // Find the actual stored URL for this filename
    const storedUrl = CANDIDATE_FILE_COLUMNS.map((c) => row[c] as string | null)
      .find((u) => u && (u === legacyUrl || u.includes(filename)));

    if (storedUrl) {
      serveLocalOrRedirect(res, storedUrl, filename);
    } else {
      res.status(404).json({ message: 'File not found' });
    }
    return;
  }

  const employerDocResult = await pool.query(
    `SELECT ep.user_id, ed.document_url FROM employer_documents ed
     JOIN employer_profiles ep ON ep.id = ed.employer_id
     WHERE ed.document_url = $1 OR ed.document_url LIKE $2`,
    [legacyUrl, `%${filename}`]
  );

  if (employerDocResult.rows.length > 0) {
    const ownerUserId: string = employerDocResult.rows[0].user_id;
    const storedUrl: string = employerDocResult.rows[0].document_url;
    const isOwner = ownerUserId === requesterId;
    const isAdmin = requesterRole === 'admin';

    if (!isOwner && !isAdmin) {
      res.status(403).json({ message: 'Forbidden' });
      return;
    }

    serveLocalOrRedirect(res, storedUrl, filename);
    return;
  }

  // Employer logo — public-ish; any authenticated user can view
  const logoResult = await pool.query(
    `SELECT logo_url FROM employer_profiles WHERE logo_url = $1 OR logo_url LIKE $2`,
    [legacyUrl, `%${filename}`]
  );

  if (logoResult.rows.length > 0) {
    const storedUrl: string = logoResult.rows[0].logo_url;
    serveLocalOrRedirect(res, storedUrl, filename);
    return;
  }

  res.status(404).json({ message: 'File not found' });
}
