// File: apps/web/src/lib/db.ts
// Drizzle ORM instance with connection pooling. Deviation from arch/D-web.md
// §3: schema has no `relations()` defined, so `db.query.*` (the relational
// query API) is unavailable; every route below uses the core query builder
// (`db.select().from(table).where(...)`) instead.

import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from '@keyholder/db';
import { env } from './env';

let client: ReturnType<typeof postgres> | null = null;
let db: PostgresJsDatabase<typeof schema> | null = null;

export function getDb(): PostgresJsDatabase<typeof schema> {
  if (!db) {
    client = postgres(env.DATABASE_URL, {
      max: 10,
      idle_timeout: 30,
      connect_timeout: 10,
      prepare: false,
    });
    db = drizzle(client, { schema });
  }
  return db;
}

export type Db = ReturnType<typeof getDb>;
export { schema };
