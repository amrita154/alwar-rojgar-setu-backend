import { Response } from 'express';
import { pool } from '../config/database';
import { AuthRequest } from '../middleware/auth';

export async function getCurrentUser(req: AuthRequest, res: Response): Promise<void> {
  if (!req.user) {
    res.status(401).json({ message: 'Authentication required' });
    return;
  }

  const { userId, role } = req.user;
  let profileCompleted = false;
  let employerStatus: string | undefined;

  if (role === 'candidate') {
    const result = await pool.query('SELECT id FROM candidate_profiles WHERE user_id = $1', [userId]);
    profileCompleted = result.rows.length > 0;
  } else if (role === 'employer') {
    const result = await pool.query('SELECT id, status FROM employer_profiles WHERE user_id = $1', [userId]);
    profileCompleted = result.rows.length > 0;
    if (profileCompleted) employerStatus = result.rows[0].status;
  } else if (role === 'admin') {
    profileCompleted = true;
  }

  const userResult = await pool.query('SELECT is_active FROM users WHERE id = $1', [userId]);
  const isActive = userResult.rows[0]?.is_active ?? true;

  res.json({ userId, role, profileCompleted, isActive, ...(employerStatus !== undefined && { employerStatus }) });
}
