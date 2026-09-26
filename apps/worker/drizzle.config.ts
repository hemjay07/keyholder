// File: apps/worker/drizzle.config.ts
// [VERIFIED per npm view, 2026-09-26] — drizzle-kit 0.31.11 uses `dialect`,
// not the `driver: 'pg'` key from arch/B-worker.md (that key is drizzle-kit
// <0.21). See DEV-002.

import { defineConfig } from 'drizzle-kit';
import * as dotenv from 'dotenv';

dotenv.config({ path: '../../.env' });

export default defineConfig({
  schema: './src/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL || '',
  },
  migrations: {
    prefix: 'timestamp',
  },
  verbose: true,
  strict: true,
});
