import { card, OG_SIZE } from "@/lib/og/card";
import { fetchProtocol } from "@/lib/api-client";
import { controlLabel, timelockLabel } from "@/lib/console-data";
export const size = OG_SIZE;
export const contentType = "image/png";
export const alt = "Who controls this protocol";
export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const p = await fetchProtocol(slug).catch(() => null);
  if (!p) return card({ kicker: "Protocol", headline: "Protocol not found." });
  const f = p.controlFacts;
  const tl = timelockLabel(f);
  const weak = f?.timelock?.kind === "none" || f?.timelock?.kind === "no_timelock_feature";
  const state = f && f.threshold != null && f.members != null ? { threshold: f.threshold, members: f.members, timelock: tl, weak } : null;
  return card({ kicker: "Protocol", headline: state ? `${p.name}: ${state.threshold} of ${state.members} keys` : `${p.name}: ${controlLabel(f)}`, sub: state ? (weak ? `${tl === "none" ? "No timelock" : "No timelock feature"}: the next change lands the moment enough keys sign.` : `Timelock ${tl}.`) : undefined, state });
}
