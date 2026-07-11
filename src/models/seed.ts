import { pool } from '../config/database';

async function seed() {
  console.log('Seeding database...');
  try {
    // Admin (seeded admins are pre-approved so the Admin Users tab shows a valid status)
    await pool.query(`
      INSERT INTO users (id, phone, role, is_active, name, admin_status)
      VALUES ('00000000-0000-0000-0000-000000000001', '+919999999999', 'admin', true, 'District Admin', 'approved')
      ON CONFLICT (phone) DO UPDATE
        SET name = COALESCE(users.name, EXCLUDED.name),
            admin_status = COALESCE(users.admin_status, EXCLUDED.admin_status)
    `);

    // Demo Employer (+911111111111, OTP always 123456)
    await pool.query(`
      INSERT INTO users (id, phone, role, is_active)
      VALUES ('00000000-0000-0000-0000-000000000002', '+911111111111', 'employer', true)
      ON CONFLICT (phone) DO NOTHING
    `);
    await pool.query(`
      INSERT INTO employer_profiles (
        id, user_id, company_name, gst_number, status,
        contact_person_name, contact_person_phone, contact_person_email, contact_person_designation
      )
      VALUES (
        '00000000-0000-0000-0000-000000000012',
        '00000000-0000-0000-0000-000000000002',
        'Demo Industries Pvt Ltd',
        '08ABCDE1234F1Z5',
        'verified',
        'Rakesh Gupta', '9829010001', 'rakesh@demoindustries.example.com', 'HR Manager'
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
        id, user_id, full_name, email, phone, description,
        highest_education, iti_trade, iti_college, graduation_year,
        work_experience_months,
        skills, city, district, pincode
      ) VALUES (
        '00000000-0000-0000-0000-000000000013',
        '00000000-0000-0000-0000-000000000003',
        'Ramu Demo',
        'ramu.demo@example.com',
        '9811100001',
        'ITI Electrician with 1.5 years of wiring and panel-work experience. Reliable and available for shift work near Alwar.',
        'ITI', 'Electrician', 'Govt ITI Alwar', 2022,
        18,
        ARRAY['Wiring', 'Motor Rewinding', 'Panel Work'],
        'Alwar', 'Alwar', '301001'
      )
      ON CONFLICT (user_id) DO NOTHING
    `);

    // Featured employers — verified companies with active jobs so the public
    // home page ("Featured Employers") shows real DB data instead of the
    // demo-only curated fallback. Idempotent via ON CONFLICT.
    const ADMIN_ID = '00000000-0000-0000-0000-000000000001';
    const featured = [
      {
        uid: '00000000-0000-0000-0000-0000000f0001',
        pid: '00000000-0000-0000-0000-0000000f1001',
        phone: '+919000000001',
        name: 'Havells India Ltd.',
        gst: '08HAVLS1234A1Z1',
        contact: ['Manoj Verma', '9829010005', 'manoj.verma@havells.example.com', 'Plant HR'],
        jobs: [
          { id: '00000000-0000-0000-0000-0000000f2001', title: 'Electrician – Appliance Assembly', trade: 'Electrician', gross: 23000, openings: 8, desc: 'Assemble and test electrical appliances on the Alwar (MIA) line. ESI/PF, day shift, on-the-job training. Local ITI candidates preferred.' },
          { id: '00000000-0000-0000-0000-0000000f2002', title: 'Fitter – Motor Assembly Line', trade: 'Fitter', gross: 21000, openings: 6, desc: 'Motor assembly-line fitter role. Stable shifts and benefits. ITI Fitter background preferred.' },
        ],
      },
      {
        uid: '00000000-0000-0000-0000-0000000f0002',
        pid: '00000000-0000-0000-0000-0000000f1002',
        phone: '+919000000002',
        name: 'Hero MotoCorp',
        gst: '08HERMC5678B1Z2',
        contact: ['Suresh Rana', '9829010006', 'suresh.rana@heromotocorp.example.com', 'HR Manager'],
        jobs: [
          { id: '00000000-0000-0000-0000-0000000f2003', title: 'Fitter – Automotive Assembly', trade: 'Fitter', gross: 24000, openings: 10, desc: 'Automotive assembly fitter for two-wheeler manufacturing. Benefits + training provided.' },
        ],
      },
      {
        uid: '00000000-0000-0000-0000-0000000f0003',
        pid: '00000000-0000-0000-0000-0000000f1003',
        phone: '+919000000003',
        name: 'RSPL Ltd. (Ghari)',
        gst: '08RSPLG9012C1Z3',
        contact: ['Deepak Sharma', '9829010007', 'deepak.sharma@rspl.example.com', 'HR Executive'],
        jobs: [
          { id: '00000000-0000-0000-0000-0000000f2004', title: 'Machine Operator – Packaging', trade: 'Fitter', gross: 20000, openings: 12, desc: 'Operate packaging machinery at the Alwar (MIA) plant. Freshers welcome; training provided.' },
        ],
      },
      {
        uid: '00000000-0000-0000-0000-0000000f0004',
        pid: '00000000-0000-0000-0000-0000000f1004',
        phone: '+919000000004',
        name: 'AU Small Finance Bank',
        gst: '08AUSFB3456D1Z4',
        contact: ['Kavita Meena', '9829010008', 'kavita.meena@aubank.example.com', 'Zonal HR'],
        jobs: [
          { id: '00000000-0000-0000-0000-0000000f2005', title: 'Customer Service Executive', trade: null, gross: 28000, openings: 4, desc: 'Handle counter transactions and customer queries at Alwar branches. Graduate required.' },
        ],
      },
      {
        uid: '00000000-0000-0000-0000-0000000f0005',
        pid: '00000000-0000-0000-0000-0000000f1005',
        phone: '+919000000005',
        name: 'HDFC Bank',
        gst: '08HDFCB7890E1Z5',
        contact: ['Pankaj Joshi', '9829010009', 'pankaj.joshi@hdfcbank.example.com', 'Branch HR'],
        jobs: [
          { id: '00000000-0000-0000-0000-0000000f2006', title: 'Branch Banking Officer', trade: null, gross: 32000, openings: 2, desc: 'Manage daily banking operations at the Alwar branch. Graduate with good communication skills.' },
        ],
      },
    ];

    for (const f of featured) {
      await pool.query(
        `INSERT INTO users (id, phone, role, is_active)
         VALUES ($1, $2, 'employer', true)
         ON CONFLICT (phone) DO NOTHING`,
        [f.uid, f.phone],
      );
      await pool.query(
        `INSERT INTO employer_profiles (
           id, user_id, company_name, gst_number, status, verified_by, verified_at,
           contact_person_name, contact_person_phone, contact_person_email, contact_person_designation
         ) VALUES ($1, $2, $3, $4, 'verified', $5, NOW(), $6, $7, $8, $9)
         ON CONFLICT (user_id) DO NOTHING`,
        [f.pid, f.uid, f.name, f.gst, ADMIN_ID, f.contact[0], f.contact[1], f.contact[2], f.contact[3]],
      );
      for (const j of f.jobs) {
        await pool.query(
          `INSERT INTO jobs (id, employer_id, title, description, gross_salary, job_type, openings, trade_required, district, status)
           VALUES ($1, $2, $3, $4, $5, 'permanent', $6, $7, 'Alwar', 'active')
           ON CONFLICT DO NOTHING`,
          [j.id, f.pid, j.title, j.desc, j.gross, j.openings, j.trade],
        );
      }
    }

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
