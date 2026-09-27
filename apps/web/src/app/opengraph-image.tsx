import { card, OG_SIZE } from "@/lib/og/card";
export const size = OG_SIZE;
export const contentType = "image/png";
export const alt = "Keyholder: who can move the money in every Solana protocol";
export default async function Image() {
  return card({ kicker: "Count the keys", headline: "Drift needed two keys to lose $285M.", sub: "Who can move the money in every Solana protocol, and whether that just changed.", state: { threshold: 2, members: 5, timelock: "none", weak: true } });
}
