import { card, OG_SIZE } from "@/lib/og/card";
export const size = OG_SIZE;
export const contentType = "image/png";
export const alt = "Refused on-chain: the devnet proof";
export default async function Image() {
  return card({ kicker: "Proof · devnet", headline: "Refused on-chain.", sub: "A vault asked Keyholder before a deposit. The multisig dropped to 2 of 5; 23 seconds later the same deposit reverted.", state: { threshold: 2, members: 5, timelock: "none", weak: true } });
}
