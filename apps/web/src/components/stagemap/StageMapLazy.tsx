'use client';
// File: apps/web/src/components/stagemap/StageMapLazy.tsx
// three.js is ~270 KB gzipped: the map loads after the headline paints, never on the server.
import dynamic from 'next/dynamic';
import type { StageMapProps } from './StageMap';

const StageMap = dynamic(() => import('./StageMap'), { ssr: false, loading: () => null });
export default function StageMapLazy(props: StageMapProps) { return <StageMap {...props} />; }
