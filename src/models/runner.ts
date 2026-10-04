import fs from 'fs';
import path from 'path';
import type { PoolClient } from 'pg';
import { pool } from '../config/database';

const MIGRATIONS_DIR = path.join(__dirname, 'migrations');

// Files containing this directive run OUTSIDE a transaction, one statement at a
// time. Needed for statements PostgreSQL forbids inside a transaction block or
// function — notably `ALTER TYPE ... ADD VALUE`. Such files must contain only
// simple statements (no DO blocks / dollar-quoted bodies) and each statement
// must be individually idempotent (e.g. use IF NOT EXISTS), because a failure
// part-way cannot be rolled back.
const NO_TX_DIRECTIVE = 'migrate:no-transaction';

function migrationFiles(): string[] {
  return fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort();
}

function splitStatements(sql: string): string[] {
  return sql
    .split(';')
    .map((segment) =>
      segment
        .split('\n')
        .filter((line) => !line.trim().startsWith('--'))
        .join('\n')
        .trim()
    )
    .filter((segment) => segment.length > 0);
}

async function ensureHistoryTable(client: PoolClient) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version VARCHAR(255) PRIMARY KEY,
      applied_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
    )
  `);
}

// Mark migrations as already applied WITHOUT running them. Use this exactly once
// when adopting a pre-existing database into the migration system: the schema it
// already has is represented by the baseline file(s), so we record them as done
// rather than re-executing them. Default target is the first (initial-schema)
// migration; pass a filename to baseline everything up to and including it.
async function baseline(upto?: string) {
  const client = await pool.connect();
  try {
    await ensureHistoryTable(client);
    const files = migrationFiles();
    if (files.length === 0) throw new Error('No migration files found.');

    const target = upto ?? files[0];
    if (!files.includes(target)) {
      throw new Error(`Unknown migration: ${target}`);
    }

    for (const file of files) {
      await client.query(
        'INSERT INTO schema_migrations (version) VALUES ($1) ON CONFLICT DO NOTHING',
        [file]
      );
      console.log(`  baseline ${file}`);
      if (file === target) break;
    }
    console.log(
      `Baseline complete up to ${target} — marked applied WITHOUT running. ` +
        `Run "npm run db:migrate" to apply anything newer.`
    );
  } finally {
    client.release();
    await pool.end();
  }
}

async function migrate() {
  const client = await pool.connect();
  try {
    await ensureHistoryTable(client);

    const { rows: applied } = await client.query<{ version: string }>(
      'SELECT version FROM schema_migrations ORDER BY version'
    );
    const appliedSet = new Set(applied.map((r) => r.version));

    let ran = 0;
    for (const file of migrationFiles()) {
      if (appliedSet.has(file)) {
        console.log(`  skip  ${file}`);
        continue;
      }

      const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8');

      if (sql.includes(NO_TX_DIRECTIVE)) {
        // No transaction to wrap: run each statement standalone, then record.
        // If a statement throws we stop before recording, so the (idempotent)
        // file is retried on the next run.
        for (const statement of splitStatements(sql)) {
          await client.query(statement);
        }
        await client.query(
          'INSERT INTO schema_migrations (version) VALUES ($1)',
          [file]
        );
        console.log(`  apply ${file} (no-transaction)`);
      } else {
        // Schema change and its history row commit together — all or nothing.
        await client.query('BEGIN');
        try {
          await client.query(sql);
          await client.query(
            'INSERT INTO schema_migrations (version) VALUES ($1)',
            [file]
          );
          await client.query('COMMIT');
          console.log(`  apply ${file}`);
        } catch (err) {
          await client.query('ROLLBACK');
          throw err;
        }
      }
      ran++;
    }

    console.log(
      ran === 0 ? 'Already up to date.' : `Migrations complete (${ran} applied).`
    );
  } finally {
    client.release();
    await pool.end();
  }
}

function fail(err: unknown) {
  console.error('Migration failed:', err);
  process.exit(1);
}

const command = process.argv[2];
if (command === 'baseline') {
  baseline(process.argv[3]).catch(fail);
} else {
  migrate().catch(fail);
}
