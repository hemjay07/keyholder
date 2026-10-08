import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { transactionPda, classifyInstruction, configActions, controlRelevant, type PendingTx } from './pending';

const fx = JSON.parse(readFileSync(join(__dirname, 'fixtures-pending.json'), 'utf8')) as { pending: PendingTx[] };
const LOADER = 'BPFLoaderUpgradeab1e11111111111111111111111';
const u32 = (n: number) => { const b = Buffer.alloc(4); b.writeUInt32LE(n); return b; };

describe('transactionPda (real mainnet proposals, read 2026-10-08)', () => {
  it('derives the transaction account each proposal votes on', () => {
    for (const t of fx.pending) expect(transactionPda(t.multisig, BigInt(t.index))).toBe(t.address);
  });
});

describe('classifyInstruction', () => {
  it('loader Upgrade / SetAuthority / Close', () => {
    expect(classifyInstruction(LOADER, u32(3), ['pd', 'prog', 'buf']).type).toBe('program_upgrade');
    expect(classifyInstruction(LOADER, u32(4), ['pd', 'cur', 'new'])).toEqual({ type: 'set_upgrade_authority', programData: 'pd', newAuthority: 'new' });
    expect(classifyInstruction(LOADER, u32(7), ['pd', 'cur', 'new']).type).toBe('set_upgrade_authority');
    expect(classifyInstruction(LOADER, u32(5), ['acct']).type).toBe('close_program');
  });
  it('token Transfer and TransferChecked read amount and destination at the right positions', () => {
    const t = Buffer.alloc(9); t[0] = 3; t.writeBigUInt64LE(610000000000n, 1);
    expect(classifyInstruction('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA', t, ['src', 'dst', 'auth'])).toEqual({ type: 'token_transfer', source: 'src', destination: 'dst', amountRaw: '610000000000' });
    const c = Buffer.alloc(10); c[0] = 12; c.writeBigUInt64LE(5n, 1);
    expect(classifyInstruction('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA', c, ['src', 'mint', 'dst', 'auth']).destination).toBe('dst');
  });
  it('anything else is a plain call with its program and first bytes, never guessed', () => {
    expect(classifyInstruction('Prog111', Buffer.from('abcdef', 'hex'), [])).toEqual({ type: 'call', program: 'Prog111', dataHex: 'abcdef' });
  });
});

describe('configActions and relevance', () => {
  it('maps Squads config actions', () => {
    expect(configActions([{ variant: 'ChangeThreshold', fields: { newThreshold: 3 } }, { variant: 'SetTimeLock', fields: { newTimeLock: 86400 } }, { variant: 'SetRentCollector', fields: {} }]))
      .toEqual([{ type: 'change_threshold', to: 3 }, { type: 'set_timelock', seconds: 86400 }, { type: 'other_config', action: 'SetRentCollector' }]);
  });
  it('the real fixtures are control-relevant; a plain call is not', () => {
    for (const t of fx.pending) expect(controlRelevant(t)).toBe(true);
    expect(controlRelevant({ ...fx.pending[0]!, actions: [{ type: 'call', program: 'x', dataHex: '' }] })).toBe(false);
  });
});
