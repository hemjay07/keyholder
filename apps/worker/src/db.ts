// File: apps/worker/src/db.ts
// [VERIFIED] — ARCHITECTURE.md §4 / arch/B-worker.md §1: connection pool + schema.

import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

export function initDb(databaseUrl: string = process.env.DATABASE_URL ?? ''): PostgresJsDatabase<typeof schema> {
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is required to initialize the database');
  }
  // Supabase's session pooler allows 15 clients in total; the worker keeps a small
  // share so the web app (transaction pooler) never starves (2026-09-27).
  const pgClient = postgres(databaseUrl, { max: Number(process.env.PG_POOL_MAX ?? 4) });
  return drizzle(pgClient, { schema });
}

export type Db = PostgresJsDatabase<typeof schema>;
export { schema };
