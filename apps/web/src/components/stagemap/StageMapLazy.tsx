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
  // Fetch the map's code in the first idle moment after paint (so it is ready before anyone scrolls to it), and mount
  // it once it is within two screens; whichever comes first wins, so a fast scroller never sees an empty frame.
  useEffect(() => {
    const el = ref.current; if (!el) return;
    const ric = (window as { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number }).requestIdleCallback;
    const warm = () => { void import('./StageMap'); };
    const id = ric ? ric(warm, { timeout: 1200 }) : window.setTimeout(warm, 600);
    const io = new IntersectionObserver(([e]) => { if (e?.isIntersecting) { setNear(true); io.disconnect(); } }, { rootMargin: '200% 0px' });
    io.observe(el);
    return () => { io.disconnect(); if (!ric) clearTimeout(id); };
  }, []);
  return <div ref={ref} style={{ width: '100%', height: '100%' }}>{near && <StageMap {...props} />}</div>;
}
