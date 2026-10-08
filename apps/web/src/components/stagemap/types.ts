// File: apps/web/src/components/stagemap/types.ts
export interface MapProgram { id: string; stage: 0 | 1 | 2 | 3; usd: number; binding: string; closed: boolean }
export interface Mark extends MapProgram { x: number; z: number; base: number; h: number; w: number }
export type { ControlFacts } from '@/lib/records';
