-- Migration: 002_add_interview_scheduled_enum
-- Deployed: 2026-10-05 (PR #8 — feature/testimonials-interview)
-- migrate:no-transaction
--
-- Adds 'interview_scheduled' to the application_status enum.
--
-- Runs OUTSIDE a transaction. PostgreSQL cannot execute
-- ALTER TYPE ... ADD VALUE from inside a DO block / function, and the
-- original migrate.ts wrapped it in `DO $$ ... EXCEPTION WHEN others THEN null`,
-- which silently swallowed that failure. The runner executes each statement in
-- this file as a standalone top-level command (no BEGIN/COMMIT), which works on
-- every PostgreSQL version. IF NOT EXISTS makes it safe to re-run.

ALTER TYPE application_status ADD VALUE IF NOT EXISTS 'interview_scheduled' AFTER 'shortlisted';
