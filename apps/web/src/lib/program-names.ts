// File: apps/web/src/lib/program-names.ts
// Display names for program ids we have confirmed (protocol docs and verified builds). Every other program shows
// its shortened address; a name here never claims ownership beyond the program id it labels.
export const PROGRAM_NAMES: Record<string, string> = {
  KLend2g3cP87fffoy8q1mQqGKjrxjC8boSyAYavgmjD: 'Kamino Lend',
  PERPHjGBqRHArX4DySjwM6UJHiR3sWAatqfdBS2qQJu: 'Jupiter Perps',
  '675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8': 'Raydium AMM v4',
  cpamdpZCGKUy5JxQXB4dcpGPiikHawvSWAd6mEn1sGG: 'Meteora DAMM v2',
  JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4: 'Jupiter Aggregator v6',
  whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc: 'Orca Whirlpools',
  CAMMCzo5YL8w4VFF8KVHrK22GGUsp5VTaW7grrKgrWqK: 'Raydium CLMM',
  LBUZKhRxPF3XUpBCjp4YzTKgLccjZhTSDM9YuVaPwxo: 'Meteora DLMM',
  dRiftyHA39MWEi3m9aunc5MzRF1JYuBsbn6VPcn33UH: 'Drift v2',
  MarBmsSgKXdrN1egZf5sqe1TMai9K1rChYNDJgjq7aD: 'Marinade',
};

export const shortAddr = (k: string) => `${k.slice(0, 4)}…${k.slice(-4)}`;
export const programName = (id: string) => PROGRAM_NAMES[id] ?? shortAddr(id);
