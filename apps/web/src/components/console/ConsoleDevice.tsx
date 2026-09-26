// Server-safe entry point: loads the WebGL console only on the client, after the text
// paints, so LCP never waits on it. Renders the static fallback while the chunk loads,
// under reduced motion, and when WebGL is unavailable (ConsoleScene itself handles those
// last two cases once mounted).
"use client";

import { lazy, Suspense } from "react";
import type { ConsoleData } from "./Console";
import ConsoleFallback from "./ConsoleFallback";

const ConsoleScene = lazy(() => import("./ConsoleScene"));

export default function ConsoleDevice({ data }: { data: ConsoleData }) {
  return (
    <div className="console-frame">
      <Suspense fallback={<ConsoleFallback data={data} />}>
        <ConsoleScene data={data} />
      </Suspense>
    </div>
  );
}

export { ConsoleFallback };
