import { Pool } from 'pg';
import { config } from './index';

// DATABASE_URL takes priority (Neon / Render connection string with SSL)
const isServerless = !!process.env.VERCEL;

export const pool = process.env.DATABASE_URL
  ? new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false },
      max: isServerless ? 1 : 10,
      idleTimeoutMillis: isServerless ? 10000 : 30000,
      connectionTimeoutMillis: isServerless ? 10000 : 5000,
    })
  : new Pool({
      host: config.db.host,
      port: config.db.port,
      database: config.db.name,
      user: config.db.user,
      password: config.db.password,
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    });

pool.on('error', (err) => {
  console.error('Unexpected error on idle database client', err);
});
