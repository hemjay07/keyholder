// File: packages/db/src/index.ts
// [VERIFIED] — arch/D-web.md §3: web and worker must share one schema.
// Re-export every table definition from the worker's schema so both layers
// query against identical Drizzle table objects.
export * from '../../../apps/worker/src/schema';
