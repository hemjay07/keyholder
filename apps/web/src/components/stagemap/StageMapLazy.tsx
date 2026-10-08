'use client';
// File: apps/web/src/components/stagemap/StageMapLazy.tsx
// three.js is ~270 KB gzipped: the map's code is fetched only when its section nears the viewport, never on the server.
import dynamic from 'next/dynamic';
import { useEffect, useRef, useState } from 'react';
import type { StageMapProps } from './StageMap';

const StageMap = dynamic(() => import('./StageMap'), { ssr: false, loading: () => null });

export default function StageMapLazy(props: StageMapProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [near, setNear] = useState(false);
  useEffect(() => {
    const el = ref.current; if (!el) return;
    const io = new IntersectionObserver(([e]) => { if (e?.isIntersecting) { setNear(true); io.disconnect(); } }, { rootMargin: '600px 0px' });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return <div ref={ref} style={{ width: '100%', height: '100%' }}>{near && <StageMap {...props} />}</div>;
}
