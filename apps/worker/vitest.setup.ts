// Global test setup: database tests run against `<dev db>_test`, never the dev
// database. schema.test.ts deletes and rewrites real Drift rows in beforeAll;
// run against the dev database it repointed the real Drift program at a
// `drift-test` protocol (found 2026-09-26). dotenv never overrides a variable
// that is already set, so setting DATABASE_URL here wins over each test's own
// dotenv.config call.

import { config } from 'dotenv';
import { join } from 'node:path';
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';

export default async function setup(): Promise<void> {
  config({ path: join(__dirname, '..', '..', '.env'), quiet: true });
  const devUrl = process.env.DATABASE_URL;
  if (!devUrl) return;

  const url = new URL(devUrl);
  const devName = url.pathname.slice(1);
  const testName = devName.endsWith('_test') ? devName : `${devName}_test`;

  const admin = postgres(devUrl, { max: 1 });
  const exists = await admin`select 1 from pg_database where datname = ${testName}`;
  if (exists.length === 0) await admin.unsafe(`create database "${testName}"`);
  await admin.end();

  url.pathname = `/${testName}`;
  const testUrl = url.toString();
  const sql = postgres(testUrl, { max: 1, onnotice: () => {} });
  await migrate(drizzle(sql), { migrationsFolder: join(__dirname, 'drizzle') });
  await sql.end();

  process.env.DATABASE_URL = testUrl;
}
