/**
 * Shared safety guard for the e2e database lifecycle.
 *
 * Both `ensure-test-db.ts` (which CREATEs the database) and `global-setup.ts`
 * (which TRUNCATEs it) call this, so the "must be a disposable TEST database"
 * rule lives in exactly one place and can't drift between the two. Neither
 * destructive step proceeds unless `DATABASE_URL` names a database containing
 * "test" — that's what stops a stray run from creating noise in, or wiping,
 * the dev/prod database.
 */
export interface TestDatabaseTarget {
  /** The full validated DATABASE_URL. */
  url: string;
  /** The target database name (decoded), guaranteed to contain "test". */
  dbName: string;
}

export function resolveTestDatabaseTarget(): TestDatabaseTarget {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      'e2e: DATABASE_URL is not set. Export a disposable test database URL ' +
        '(its name must contain "test") before running the suite.',
    );
  }

  const dbName = decodeURIComponent(new URL(url).pathname.replace(/^\//, ''));
  if (!/test/i.test(dbName)) {
    throw new Error(
      `e2e: refusing to operate on database "${dbName}" — its name does not ` +
        'look like a disposable test database. Point DATABASE_URL at a ' +
        `throwaway DB whose name contains "test" (e.g. "${dbName}_test").`,
    );
  }

  return { url, dbName };
}
