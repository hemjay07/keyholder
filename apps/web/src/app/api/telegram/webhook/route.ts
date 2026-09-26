// File: apps/web/src/app/api/telegram/webhook/route.ts
// POST /api/telegram/webhook — verifies Telegram's X-Telegram-Bot-Api-Secret-Token
// header (https://core.telegram.org/bots/api#setwebhook). DISABLED until
// TELEGRAM_BOT_TOKEN exists (DEV-050: no token yet, never mocked in a demo
// path) — returns 503 so this is unambiguous in logs rather than silently
// accepting/discarding updates.

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { env } from '@/lib/env';

const telegramUpdateSchema = z.object({
  message: z
    .object({
      chat: z.object({ id: z.number() }),
      text: z.string().optional(),
    })
    .optional(),
});

export async function POST(req: Request) {
  if (!env.TELEGRAM_BOT_TOKEN) {
    console.log('[telegram webhook] disabled: TELEGRAM_BOT_TOKEN not set');
    return NextResponse.json({ ok: false, error: 'telegram channel disabled: no bot token configured' }, { status: 503 });
  }

  const token = req.headers.get('X-Telegram-Bot-Api-Secret-Token');
  if (token !== env.TELEGRAM_BOT_TOKEN) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const update = telegramUpdateSchema.parse(body);

    if (!update.message?.text?.startsWith('/start')) {
      return NextResponse.json({ ok: true });
    }

    // /start <wallet>:<signature> binds this chat to a wallet's subscriptions.
    // Left as a stub: needs the same SIWS verification as lib/auth.ts, wired
    // once the bot token exists to test against a real chat.
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ ok: false, error: String(error) }, { status: 400 });
  }
}

export const dynamic = 'force-dynamic';
