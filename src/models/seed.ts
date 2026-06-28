import bcrypt from 'bcrypt';
import { pool } from '../config/database';

async function seed() {
  console.log('Seeding database...');
  try {
    const hashedOtp = await bcrypt.hash('123456', 10);

    // Create admin user
    await pool.query(`
      INSERT INTO users (id, phone, role, is_active)
      VALUES ('00000000-0000-0000-0000-000000000001', '+919999999999', 'admin', true)
      ON CONFLICT (phone) DO NOTHING
    `);

    console.log('Seed completed.');
    console.log('Admin phone: +919999999999');
    console.log('Dev OTP for all users: 123456');
  } catch (err) {
    console.error('Seed failed:', err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

seed();
