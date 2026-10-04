# Database Migrations

Versioned, incremental SQL migrations. Each schema change is a numbered `.sql`
file; a runner applies only the files a database has not seen yet and records
what it applied. This replaces the old single-file `migrate.ts`.

## Layout

```
src/models/
  runner.ts                  # applies pending migrations, tracks history
  migrations/
    001_initial_schema.sql   # baseline — full schema as of the first VPS release
    002_add_interview_scheduled_enum.sql
    003_testimonials_interview_admin_roles.sql
```

## How it works

1. Runner ensures a `schema_migrations` table exists:

   | Column | Meaning |
   |--------|---------|
   | `version` | migration filename, e.g. `003_testimonials_interview_admin_roles.sql` |
   | `applied_at` | when it ran |

2. Reads every `migrations/*.sql` in sorted (numeric) order.
3. Skips any filename already in `schema_migrations`.
4. Runs each new file, then records its filename. Transactional files that fail
   roll back and abort the run.

Run it:

```bash
npm run db:migrate
```

Output example:

```
  skip  001_initial_schema.sql
  skip  002_add_interview_scheduled_enum.sql
  apply 003_testimonials_interview_admin_roles.sql
Migrations complete (1 applied).
```

A fresh/empty database and an existing one take the **same path** — the runner
just applies more files on a fresh DB. There is no separate "fresh install"
script.

## Writing a new migration

1. Create `migrations/NNN_short_description.sql` — next zero-padded number.
2. Add a header comment: what changed and why.
3. Make it idempotent and additive:
   - `CREATE TABLE IF NOT EXISTS`, `CREATE INDEX IF NOT EXISTS`
   - wrap `ADD COLUMN` in `DO $$ ... EXCEPTION WHEN duplicate_column THEN null; END $$;`
   - never `DROP` / rename / retype a column that holds production data without a
     deliberate, separately reviewed migration.
4. Commit the file with the code that depends on it.

### Non-transactional statements

Some statements cannot run inside a transaction or a `DO` block — notably
`ALTER TYPE ... ADD VALUE` (enum). Put the directive on its own comment line:

```sql
-- migrate:no-transaction
ALTER TYPE application_status ADD VALUE IF NOT EXISTS 'interview_scheduled' AFTER 'shortlisted';
```

Such a file:
- runs each statement as a standalone top-level command (no `BEGIN`/`COMMIT`),
- must contain **only simple statements** (no `DO` blocks / `$$` bodies),
- each statement must be individually idempotent (use `IF NOT EXISTS`), because a
  partial failure cannot be rolled back.

This is why `002` is split from `003`: the enum add must be non-transactional;
the column and table additions are plain transactional DDL.

## Adopting a pre-existing database (one-time baseline)

The production DB already has the `001_initial_schema` schema (built by the old
`migrate.ts`). We do **not** want the runner to execute `001` against it — we
mark it as already applied, so only genuinely new migrations run.

Run **once**, before the first `db:migrate` on that DB:

```bash
npm run db:baseline          # marks 001_initial_schema.sql as applied (not run)
```

`schema_migrations` then reads:

```
001_initial_schema.sql              applied   <- baseline, never executed here
```

The next `npm run db:migrate` runs `002` and `003` only:

```
  skip  001_initial_schema.sql
  apply 002_add_interview_scheduled_enum.sql (no-transaction)
  apply 003_testimonials_interview_admin_roles.sql
```

To baseline through a later file (rarely needed):
`npm run db:baseline -- 003_testimonials_interview_admin_roles.sql`.

A **fresh/empty** database is never baselined — just `npm run db:migrate`, which
runs `001`, `002`, `003` in order.

## Why 002 and 003 are still safe even if not baselined

- Every migration is **additive and idempotent**. New columns are nullable (or
  have a constant default), so existing rows are untouched; new tables start
  empty. On PostgreSQL 11+ adding such columns is a metadata-only change — no
  full-table rewrite, locks are brief even with lots of rows.
- `002` re-adds the enum value with `IF NOT EXISTS` — this is the self-heal for
  the case where the old `migrate.ts` silently failed to add it.
- `003`'s columns/table were already created successfully by the old
  `migrate.ts`, so its guards make it a no-op; the runner simply records it.

## Backups and rollback

- **Always `pg_dump` before migrating** (see deploy steps). Keep the dump until
  the deploy is validated.
- These migrations are additive, so there is **no automatic down-migration**.
  Restoring a full dump over a DB that has already taken new writes is a
  recovery operation, not a routine one-command rollback — stop the app and
  assess first. In practice, an additive migration rarely needs a rollback; a
  forward fix (a new `NNN_*.sql`) is usually the right response.

## Deploy steps (VPS)

```bash
cd /path/to/alwar-rojgar-setu-backend

# 1. Back up first
pg_dump -h localhost -U <db_user> <db_name> \
  > ~/backup_before_migrations_$(date +%Y%m%d_%H%M%S).sql

# 2. Review local divergence before pulling — do NOT blindly discard.
#    (The VPS has intentionally removed @vercel/blob from package.json.)
git status
git diff package.json package-lock.json
#    Decide: keep master's version, or re-apply the local change after pull.

# 3. Pull, install (dev deps needed for tsx + tsc), migrate, build
git pull origin master
npm install
npm run db:baseline      # FIRST TIME ONLY on the existing prod DB
npm run db:migrate
npm run build

# 4. Restart only this app (never `pm2 restart all`)
pm2 restart alwar-backend --update-env

# 5. Verify
pm2 status
pm2 logs alwar-backend --lines 50
psql -h localhost -U <db_user> <db_name> -c "SELECT * FROM schema_migrations ORDER BY version;"
psql -h localhost -U <db_user> <db_name> -c "SELECT unnest(enum_range(NULL::application_status));"
```

After the first deploy the `db:baseline` line is dropped — subsequent deploys
are just pull → install → `db:migrate` → build → restart.
