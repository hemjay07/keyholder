import { card, OG_SIZE } from "@/lib/og/card";
export const size = OG_SIZE;
export const contentType = "image/png";
export const alt = "The Drift replay: 5.6 days of warning";
export default async function Image() {
  return card({ kicker: "Replay · reconstructed", headline: "5.6 days of warning.", sub: "Drift lost $285M on 1 April 2026. Every step before the drain was on-chain.", state: { threshold: 2, members: 5, timelock: "none", weak: true } });
}
