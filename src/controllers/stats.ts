import { Request, Response } from 'express';
import { pool } from '../config/database';

interface TopEmployer {
  id: string;
  companyName: string;
  logoUrl?: string | null;
  activeJobCount: number;
  totalApplications: number;
}

export async function getPublicStats(_req: Request, res: Response): Promise<void> {
  const [activeJobs, registeredEmployers, successfulConnects, topEmployersData] = await Promise.all([
    pool.query("SELECT COUNT(*) FROM jobs WHERE status = 'active'"),
    pool.query("SELECT COUNT(*) FROM employer_profiles WHERE status = 'verified'"),
    pool.query("SELECT COUNT(DISTINCT candidate_id) FROM applications"),
    pool.query(`
      SELECT
        ep.id,
        ep.company_name,
        ep.logo_url,
        COUNT(DISTINCT CASE WHEN j.status = 'active' THEN j.id END) as active_job_count,
        COUNT(DISTINCT a.id) as total_applications
      FROM employer_profiles ep
      LEFT JOIN jobs j ON ep.id = j.employer_id
      LEFT JOIN applications a ON j.id = a.job_id
      WHERE ep.status = 'verified'
      GROUP BY ep.id, ep.company_name, ep.logo_url
      ORDER BY active_job_count DESC, total_applications DESC
      LIMIT 5
    `),
  ]);

  const topEmployers: TopEmployer[] = topEmployersData.rows.map((row: any) => ({
    id: row.id,
    companyName: row.company_name,
    logoUrl: row.logo_url,
    activeJobCount: parseInt(row.active_job_count, 10),
    totalApplications: parseInt(row.total_applications, 10),
  }));

  res.json({
    activeJobs: parseInt(activeJobs.rows[0].count, 10),
    registeredEmployers: parseInt(registeredEmployers.rows[0].count, 10),
    successfulConnects: parseInt(successfulConnects.rows[0].count, 10),
    topEmployers,
  });
}
