import { pool } from '../config/database';

async function seed() {
  console.log('Seeding database...');
  try {
    // Admin
    await pool.query(`
      INSERT INTO users (id, phone, role, is_active)
      VALUES ('00000000-0000-0000-0000-000000000001', '+919999999999', 'admin', true)
      ON CONFLICT (phone) DO NOTHING
    `);

    // Demo Employer (+911111111111, OTP always 123456)
    await pool.query(`
      INSERT INTO users (id, phone, role, is_active)
      VALUES ('00000000-0000-0000-0000-000000000002', '+911111111111', 'employer', true)
      ON CONFLICT (phone) DO NOTHING
    `);
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

    // Demo Job Seeker (+912222222222, OTP always 123456)
    await pool.query(`
      INSERT INTO users (id, phone, role, is_active)
      VALUES ('00000000-0000-0000-0000-000000000003', '+912222222222', 'candidate', true)
      ON CONFLICT (phone) DO NOTHING
    `);
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
    console.log('Admin         +919999999999  OTP: any (random)');
    console.log('Demo Employer +911111111111  OTP: 123456');
    console.log('Demo Seeker   +912222222222  OTP: 123456');
    console.log('──────────────────────────────────────────');
  } catch (err) {
    console.error('Seed failed:', err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

seed();
