// The two data states the launch console must render. Never mixed: each carries its own label.
// HERO/WONDER — Drift admin council at the drain, reconstructed.
export const HERO = {
  protocol: "DRIFT · ADMIN",
  threshold: 2,
  members: 5,
  timelockSeconds: 0,
  verified: false,
  weakened: true,
  slot: null,
  label: "Drift · admin council · 1 Apr 2026 · reconstructed",
};

// LIVE — Drift program upgrade key, read today.
export const LIVE = {
  protocol: "DRIFT · UPGRADE",
  threshold: 4,
  members: 7,
  timelockSeconds: 3600,
  verified: false,
  weakened: false,
  slot: "450,660,594",
  label: "Drift · upgrade key · read 2026-09-26 · slot 450,660,594",
};

export function stateFromQuery() {
  const q = new URLSearchParams(window.location.search).get("state");
  return q === "live" ? LIVE : HERO;
}
