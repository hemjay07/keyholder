// Server-safe entry point: loads the WebGL console only on the client, after the text
// paints, so LCP never waits on it. Renders the static fallback while the chunk loads,
// under reduced motion, and when WebGL is unavailable (ConsoleScene itself handles those
// last two cases once mounted).
"use client";

import { lazy, Suspense, ViewTransition } from "react";
import type { ConsoleData } from "./Console";
import ConsoleFallback from "./ConsoleFallback";

const ConsoleScene = lazy(() => import("./ConsoleScene"));

export default function ConsoleDevice({ data, companion }: { data: ConsoleData; companion?: ConsoleData | null }) {
  return (
    <ViewTransition name="kh-console">
      <div className="console-frame">
        <Suspense fallback={<div className="console-canvas" aria-hidden="true" />}>
          <ConsoleScene data={data} companion={companion} />
        </Suspense>
      </div>
    </ViewTransition>
  );
}

export { ConsoleFallback };
