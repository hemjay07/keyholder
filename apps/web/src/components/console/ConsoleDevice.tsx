// Server-safe entry point: loads the WebGL console only on the client, after the text
// paints, so LCP never waits on it. Renders the static fallback while the chunk loads,
// under reduced motion, and when WebGL is unavailable (ConsoleScene itself handles those
// last two cases once mounted).
"use client";

import { lazy, Suspense, ViewTransition } from "react";
import { preload } from "react-dom";
import type { ConsoleData } from "./Console";
import ConsoleFallback from "./ConsoleFallback";

const ConsoleScene = lazy(() => import("./ConsoleScene"));

// Start the 3D chunk and its lighting and textures the moment this module runs, not when the scene asks for them.
const warm = typeof window !== "undefined" ? import("./ConsoleScene") : null;
void warm;

export default function ConsoleDevice({ data, companion }: { data: ConsoleData; companion?: ConsoleData | null }) {
  preload("/hdri/studio_small_09_512.hdr", { as: "fetch", crossOrigin: "anonymous" });
  for (const href of ["/textures/metal/Color.jpg", "/textures/metal/NormalGL.jpg", "/textures/metal/Roughness.jpg", "/textures/panel_roughness_256.jpg", "/textures/panel_normal_256.jpg"]) preload(href, { as: "image" });
  return (
    <ViewTransition name="kh-console">
      <div className="console-frame">
        <Suspense fallback={<div className="console-canvas" style={{ display: "grid", placeItems: "center" }}><div className="cf-standin"><ConsoleFallback data={data} /></div></div>}>
          <ConsoleScene data={data} companion={companion} />
        </Suspense>
      </div>
    </ViewTransition>
  );
}

export { ConsoleFallback };
