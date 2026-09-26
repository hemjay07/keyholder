// File: apps/web/src/lib/env.ts
// Validated environment. Deviation from arch/D-web.md §4: that section used
// @t3-oss/env-nextjs, which is not installed and adds a dependency this
// phase does not need; a plain zod schema gives the same fail-fast guarantee.
//
// Every credential here is just-in-time (DEV-050): fields with a `.default`
// are safe to run without in dev; SESSION_SECRET, X402 and Telegram values
// are read lazily by the modules that need them, not required at import time.

import { z } from 'zod';

const schema = z.object({
  DATABASE_URL: z.string().min(1),
  SOLANA_RPC_URL: z.string().url().default('https://api.mainnet-beta.solana.com'),
  NEXT_PUBLIC_SOLANA_NETWORK: z.enum(['mainnet-beta', 'testnet', 'devnet']).default('mainnet-beta'),
  SESSION_SECRET: z.string().min(32).optional(),
  X402_PAYTO_ADDRESS: z.string().optional(),
  X402_FACILITATOR_URL: z.string().url().default('https://facilitator.payai.network'),
  TELEGRAM_BOT_TOKEN: z.string().optional(),
  VERCEL_ENV: z.enum(['development', 'preview', 'production']).default('development'),
});

export const env = schema.parse({
  DATABASE_URL: process.env.DATABASE_URL,
  SOLANA_RPC_URL: process.env.SOLANA_RPC_URL,
  NEXT_PUBLIC_SOLANA_NETWORK: process.env.NEXT_PUBLIC_SOLANA_NETWORK,
  SESSION_SECRET: process.env.SESSION_SECRET,
  X402_PAYTO_ADDRESS: process.env.X402_PAYTO_ADDRESS,
  X402_FACILITATOR_URL: process.env.X402_FACILITATOR_URL,
  TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN,
  VERCEL_ENV: process.env.VERCEL_ENV,
});
