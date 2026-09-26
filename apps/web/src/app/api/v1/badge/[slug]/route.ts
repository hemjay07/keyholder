// File: apps/web/src/app/api/v1/badge/[slug]/route.ts
// GET /api/v1/badge/:slug.svg — embeddable control badge. Colours from design/TOKENS.css:
// panel #F4F1EA, ink #1B1A17, ink-2 #5A564E, hairline rgba(27,26,23,.14),
// signal #FF5A1F only when control is weak (no timelock), verified #1F6B4A.

import { fetchProtocol } from '@/lib/api-client';
import type { ControlFacts } from '@/lib/control';

function formatSeconds(seconds: number): string {
  if (seconds % 86400 === 0) return `${seconds / 86400} d`;
  if (seconds % 3600 === 0) return `${seconds / 3600} h`;
  if (seconds % 60 === 0) return `${seconds / 60} min`;
  return `${seconds} s`;
}

function timelockLabel(timelock: ControlFacts['timelock']): { text: string; weak: boolean } {
  if (!timelock) return { text: 'unknown', weak: false };
  if (timelock.kind === 'no_timelock_feature') return { text: 'no timelock feature', weak: true };
  if (timelock.kind === 'none') return { text: 'none', weak: true };
  return { text: formatSeconds(timelock.seconds), weak: false };
}

function svg(keys: string, timelock: { text: string; weak: boolean }, status: string): string {
  const verified = status === 'verified';
  const drifted = status === 'drifted';
  const lamp = verified ? '#1F6B4A' : drifted ? '#A32F06' : 'none';
  const lampStroke = verified ? '#1F6B4A' : drifted ? '#A32F06' : '#5A564E';
  const codeText = verified ? 'ok' : drifted ? 'drift' : 'unv.';
  const timeInk = timelock.weak ? '#A32F06' : '#1B1A17';
  return `<svg xmlns="http://www.w3.org/2000/svg" width="300" height="40" viewBox="0 0 300 40" role="img" aria-label="Keyholder: ${keys} keys, timelock ${timelock.text}, ${verified ? 'verified' : drifted ? 'code drifted' : 'not verified'}">
  <rect x="0.5" y="0.5" width="299" height="39" fill="#F4F1EA" stroke="rgba(27,26,23,.14)" rx="4"/>
  <text x="10" y="16" font-family="Geist Mono, ui-monospace, monospace" font-size="9" letter-spacing=".08em" fill="#5A564E">KEYS</text>
  <text x="10" y="31" font-family="Geist Mono, ui-monospace, monospace" font-size="12" fill="#1B1A17">${keys}</text>
  <text x="84" y="16" font-family="Geist Mono, ui-monospace, monospace" font-size="9" letter-spacing=".08em" fill="#5A564E">TIMELOCK</text>
  <text x="84" y="31" font-family="Geist Mono, ui-monospace, monospace" font-size="12" fill="${timeInk}">${timelock.text}</text>
  <text x="244" y="16" font-family="Geist Mono, ui-monospace, monospace" font-size="9" letter-spacing=".08em" fill="#5A564E">CODE</text>
  <circle cx="250" cy="27" r="4.5" fill="${lamp}" stroke="${lampStroke}"/>
  <text x="259" y="31" font-family="Geist Mono, ui-monospace, monospace" font-size="9" fill="${drifted ? '#A32F06' : '#5A564E'}">${codeText}</text>
</svg>`;
}

export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug: rawSlug } = await params;
  const slug = rawSlug.replace(/\.svg$/, '');

  try {
    const protocol = await fetchProtocol(slug);
    if (!protocol || !protocol.controlFacts) {
      return new Response('Not found', { status: 404 });
    }

    const facts = protocol.controlFacts;
    const keys = facts.threshold != null && facts.members != null ? `${facts.threshold} of ${facts.members}` : 'n/a';
    const body = svg(keys, timelockLabel(facts.timelock), facts.verifiedStatus);

    return new Response(body, {
      headers: {
        'Content-Type': 'image/svg+xml',
        'Cache-Control': 'public, max-age=300',
      },
    });
  } catch (error) {
    console.error('GET /api/v1/badge failed', error);
    return new Response('Error', { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
