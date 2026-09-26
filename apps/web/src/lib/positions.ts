// File: apps/web/src/lib/positions.ts
// Re-exports the worker's position resolver (apps/worker/src/positions/resolve.ts)
// the same way @keyholder/db re-exports the worker's schema (packages/db/src/index.ts)
// — one implementation, shared by relative import inside the monorepo.
export * from '../../../worker/src/positions/resolve';
