import { pool } from '../config/database';
import bcrypt from 'bcrypt';

async function seed() {
  console.log('Seeding database...');
  try {
    // Demo passwords (will be bcrypt hashed)
    const adminPasswordHash = await bcrypt.hash('Admin@123', 12);
    const employerPasswordHash = await bcrypt.hash('Employer@123', 12);
    const candidatePasswordHash = await bcrypt.hash('Candidate@123', 12);

    // Super Admin — update email if old seed record exists, then upsert with new email
    await pool.query(`
      UPDATE users SET email = 'alwarrojarsetu@gmail.com'
      WHERE id = '00000000-0000-0000-0000-000000000001'
        AND email = 'admin@alwar-rojgar.gov.in'
    `);
    await pool.query(`
      INSERT INTO users (id, email, password_hash, role, is_active, email_verified, name, admin_status)
      VALUES ('00000000-0000-0000-0000-000000000001', 'alwarrojarsetu@gmail.com', $1, 'admin', true, true, 'Alwar Rojgar Setu Admin', 'approved')
      ON CONFLICT (id) DO UPDATE SET
        email          = EXCLUDED.email,
        password_hash  = EXCLUDED.password_hash,
        email_verified = true,
        admin_status   = 'approved',
        updated_at     = NOW()
    `, [adminPasswordHash]);

    // Demo Employer
    await pool.query(`
      INSERT INTO users (id, email, password_hash, role, is_active, email_verified, name)
      VALUES ('00000000-0000-0000-0000-000000000002', 'demo.employer@example.com', $1, 'employer', true, true, 'Demo Employer')
      ON CONFLICT (id) DO UPDATE SET email_verified = true
    `, [employerPasswordHash]);
    await pool.query(`
      INSERT INTO employer_profiles (id, user_id, company_name, gst_number, status)
      VALUES (
        '00000000-0000-0000-0000-000000000012',
        '00000000-0000-0000-0000-000000000002',
        'Demo Industries Pvt Ltd',
        '08ABCDE1234F1Z5',
        'verified'
      )
      ON CONFLICT (user_id) DO NOTHING
    `);
    await pool.query(`
      INSERT INTO jobs (id, employer_id, title, description, gross_salary, net_salary, job_type, openings, trade_required, district, status)
      VALUES (
        '00000000-0000-0000-0000-000000000022',
        '00000000-0000-0000-0000-000000000012',
        'CNC Machine Operator',
        'Operate and maintain CNC machines for precision metal parts. Day shift, 8 hrs.',
        18000, 16000, 'permanent', 3, 'Machinist', 'Alwar', 'active'
      )
      ON CONFLICT DO NOTHING
    `);

    // Demo Candidate
    await pool.query(`
      INSERT INTO users (id, email, password_hash, role, is_active, email_verified, name)
      VALUES ('00000000-0000-0000-0000-000000000003', 'demo.candidate@example.com', $1, 'candidate', true, true, 'Demo Candidate')
      ON CONFLICT (id) DO UPDATE SET email_verified = true
    `, [candidatePasswordHash]);
    await pool.query(`
      INSERT INTO candidate_profiles (
        id, user_id, full_name, email,
        highest_education, iti_trade, iti_college, graduation_year,
        work_experience_months, expected_salary,
        skills, city, district, pincode
      ) VALUES (
        '00000000-0000-0000-0000-000000000013',
        '00000000-0000-0000-0000-000000000003',
        'Ramu Demo',
        'ramu.demo@example.com',
        'ITI', 'Electrician', 'Govt ITI Alwar', 2022,
        18, 15000,
        ARRAY['Wiring', 'Motor Rewinding', 'Panel Work'],
        'Alwar', 'Alwar', '301001'
      )
      ON CONFLICT (user_id) DO NOTHING
    `);

    console.log('');
    console.log('Seed complete.');
    console.log('──────────────────────────────────────────');
    console.log('Admin          alwarrojarsetu@gmail.com   Pass: Admin@123');
    console.log('Demo Employer  demo.employer@example.com  Pass: Employer@123');
    console.log('Demo Candidate demo.candidate@example.com Pass: Candidate@123');
    console.log('──────────────────────────────────────────');
  } catch (err) {
    console.error('Seed failed:', err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

seed();
