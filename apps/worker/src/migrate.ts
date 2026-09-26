// File: apps/worker/src/migrate.ts
// Applies the Drizzle migrations in ./drizzle to DATABASE_URL.

import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';
import * as dotenv from 'dotenv';
import { join } from 'node:path';

dotenv.config({ path: join(__dirname, '..', '..', '..', '.env') });

async function main(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is not set');
  }
  const sql = postgres(databaseUrl, { max: 1 });
  const db = drizzle(sql);
  await migrate(db, { migrationsFolder: join(__dirname, '..', 'drizzle') });
  await sql.end();
  console.log('migrated ok');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
