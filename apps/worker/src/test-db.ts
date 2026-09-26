// Database tests run only against a database whose name ends in `_test`.
// schema.test.ts deletes and rewrites real Drift rows; run against the dev
// database (twice on 2026-09-26, once when vitest was started from a
// directory that skipped vitest.config.ts) it repointed the real Drift
// program at a `drift-test` protocol. This guard holds wherever vitest is
// started from: no `_test` database, no database tests.

export function testDatabaseUrl(): string | undefined {
  const url = process.env.DATABASE_URL;
  if (!url) return undefined;
  try {
    return new URL(url).pathname.replace(/^\//, '').endsWith('_test') ? url : undefined;
  } catch {
    return undefined;
  }
}
