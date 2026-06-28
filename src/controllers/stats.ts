import { Request, Response } from 'express';
import { pool } from '../config/database';

export async function getPublicStats(_req: Request, res: Response): Promise<void> {
  const activeJobs = await pool.query("SELECT COUNT(*) FROM jobs WHERE status = 'active'");
  const registeredEmployers = await pool.query("SELECT COUNT(*) FROM employer_profiles WHERE status = 'verified'");
  const successfulHires = await pool.query("SELECT COUNT(*) FROM applications WHERE status = 'hired'");

  res.json({
    activeJobs: parseInt(activeJobs.rows[0].count, 10),
    registeredEmployers: parseInt(registeredEmployers.rows[0].count, 10),
    successfulHires: parseInt(successfulHires.rows[0].count, 10),
  });
}
