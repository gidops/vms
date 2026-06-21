import { Client } from 'pg';
import { resolveTestDatabaseTarget } from './test-db-guard';

/**
 * Idempotently CREATE the e2e test database, run as `pretest:e2e` before the
 * suite (locally against Docker-hosted Postgres, in CI against a
 * service-container Postgres — identical code path either way).
 *
 * `CREATE DATABASE` cannot run inside the database being created, so we connect
 * to the `postgres` maintenance database on the SAME host/port/credentials
 * derived from DATABASE_URL. Everything (name, host, user, password) comes from
 * DATABASE_URL — nothing is hardcoded. The shared guard refuses any DB whose
 * name doesn't contain "test".
 *
 * After this, package.json runs `prisma migrate deploy` to bring the freshly
 * created (or pre-existing) DB up to the current schema.
 */
async function main(): Promise<void> {
  const { url, dbName } = resolveTestDatabaseTarget();

  // Same server, but target the maintenance DB to issue CREATE DATABASE.
  const adminUrl = new URL(url);
  adminUrl.pathname = '/postgres';

  const client = new Client({ connectionString: adminUrl.toString() });
  await client.connect();
  try {
    // The DB name is an identifier (can't be a bind parameter), so quote it and
    // escape embedded quotes. It's already validated to contain "test".
    const quoted = `"${dbName.replace(/"/g, '""')}"`;
    await client.query(`CREATE DATABASE ${quoted}`);
    console.log(`ensure-test-db: created database "${dbName}".`);
  } catch (err) {
    // 42P04 = duplicate_database. Swallow it so re-runs succeed silently.
    if ((err as { code?: string }).code === '42P04') {
      console.log(`ensure-test-db: database "${dbName}" already exists.`);
    } else {
      throw err;
    }
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error('ensure-test-db failed:', err);
  process.exit(1);
});
