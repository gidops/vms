import { PrismaClient } from '@prisma/client';
import { resolveTestDatabaseTarget } from './test-db-guard';

/**
 * Jest `globalSetup` — runs ONCE, before any e2e worker boots.
 *
 * Why this exists: the suite used to fail intermittently with
 * `Unique constraint failed on the fields: (id)` from `SeederService`'s
 * `alert.upsert()`. Two Jest workers booted the app in parallel, both ran
 * `onApplicationBootstrap`, and the non-atomic upserts raced. The fix is two
 * parts working together:
 *   1. `maxWorkers: 1` in jest-e2e.json — only one app boots at a time, so the
 *      seeders no longer race each other.
 *   2. this hook — truncate every table once up front so each suite run starts
 *      from an empty DB and the idempotent seeder repopulates deterministically
 *      (no leftover rows from a previous run colliding on fixed seed IDs).
 *
 * The seeder itself is correct and left untouched; this is purely a test-harness
 * clean slate.
 *
 * SAFETY: `TRUNCATE` is irreversible, so we refuse to run unless `DATABASE_URL`
 * clearly targets a disposable TEST database (its name must contain "test").
 * That guard is what stops a stray run from wiping the dev/prod database. Export
 * a throwaway URL before running the suite, e.g.
 *   DATABASE_URL="postgresql://vms:vms@localhost:5432/vms_test"
 */
export default async function globalSetup(): Promise<void> {
  // Confirm the target is a disposable test database before truncating anything.
  // Shared with ensure-test-db.ts so the guard can't drift between create/wipe.
  const { url } = resolveTestDatabaseTarget();

  const prisma = new PrismaClient({ datasources: { db: { url } } });
  try {
    // Derive table names from the catalogue so this survives schema growth — no
    // hardcoded list to keep in sync. Exclude Prisma's own migration ledger so
    // the schema isn't seen as drifted/unmigrated on the next run.
    const tables = await prisma.$queryRaw<{ tablename: string }[]>`
      SELECT tablename
      FROM pg_tables
      WHERE schemaname = 'public'
        AND tablename <> '_prisma_migrations'
    `;

    if (tables.length === 0) return;

    // One statement: RESTART IDENTITY resets sequences, CASCADE clears FK-linked
    // rows in the same pass so order doesn't matter.
    const list = tables.map((t) => `"public"."${t.tablename}"`).join(', ');
    await prisma.$executeRawUnsafe(
      `TRUNCATE TABLE ${list} RESTART IDENTITY CASCADE`,
    );
  } finally {
    await prisma.$disconnect();
  }
}
