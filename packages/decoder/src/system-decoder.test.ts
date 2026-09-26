// File: packages/decoder/src/system-decoder.test.ts
// [DEV-008: structural tests only — NOT real mainnet fixtures]
// See the file header in system-decoder.ts for why: a real durable-nonce
// account could not be found within this task's RPC budget
// (getProgramAccounts on the System Program was 403'd by the public
// endpoint, and no known mainnet nonce address was available to probe).
// These bytes are constructed to match the documented, stable Solana
// System Program layout — never invented arbitrarily — but are not pulled
// from a live account or transaction, and this file must not be read as
// claiming that.

import { describe, expect, it } from 'vitest';
import bs58 from 'bs58';
import { decodeSystemInstruction, parseNonceAccount, SystemDecodeError } from './system-decoder';

const SOME_PUBKEY = bs58.decode('8jj7zJgdr5bDndc7evM74FMGwzLPmd4u4QxNzFi1BMai'); // a real pubkey, used only as 32 well-formed bytes
const SOME_BLOCKHASH = bs58.decode('7qipzLR9j1JcvdxE1XJEFgvoyFmgBpgw5hMdHBMPcJtM'); // ditto — any 32 bytes serve as a stand-in hash

function buildNonceAccountBytes(opts: { version?: number; state?: number; lamportsPerSignature?: bigint } = {}): Buffer {
  const buf = Buffer.alloc(80);
  buf.writeUInt32LE(opts.version ?? 0, 0);
  buf.writeUInt32LE(opts.state ?? 1, 4);
  Buffer.from(SOME_PUBKEY).copy(buf, 8);
  Buffer.from(SOME_BLOCKHASH).copy(buf, 40);
  buf.writeBigUInt64LE(opts.lamportsPerSignature ?? 5000n, 72);
  return buf;
}

describe('parseNonceAccount — structural (DEV-008 UNTESTED against a real fixture)', () => {
  it('parses a well-formed, Initialized nonce account', () => {
    const parsed = parseNonceAccount(buildNonceAccountBytes());
    expect(parsed.version).toBe(0);
    expect(parsed.state).toBe(1);
    expect(parsed.authority).toBe(bs58.encode(SOME_PUBKEY));
    expect(parsed.durableNonce).toBe(bs58.encode(SOME_BLOCKHASH));
    expect(parsed.lamportsPerSignature).toBe(5000n);
  });

  it('parses an Uninitialized nonce account (state = 0)', () => {
    const parsed = parseNonceAccount(buildNonceAccountBytes({ state: 0 }));
    expect(parsed.state).toBe(0);
  });

  it('rejects a buffer that is not exactly 80 bytes', () => {
    expect(() => parseNonceAccount(Buffer.alloc(79))).toThrow(SystemDecodeError);
    expect(() => parseNonceAccount(Buffer.alloc(81))).toThrow(SystemDecodeError);
  });

  it('rejects a state discriminant outside {0, 1}', () => {
    const buf = buildNonceAccountBytes();
    buf.writeUInt32LE(2, 4);
    expect(() => parseNonceAccount(buf)).toThrow(SystemDecodeError);
  });
});

describe('decodeSystemInstruction — structural (DEV-008 UNTESTED against a real fixture)', () => {
  it('decodes AdvanceNonceAccount (index 4, no args)', () => {
    expect(decodeSystemInstruction(Buffer.from([4, 0, 0, 0]))).toEqual({ index: 4, type: 'AdvanceNonceAccount' });
  });

  it('decodes WithdrawNonceAccount (index 5, u64 lamports)', () => {
    const buf = Buffer.alloc(12);
    buf.writeUInt32LE(5, 0);
    buf.writeBigUInt64LE(1_000_000n, 4);
    expect(decodeSystemInstruction(buf)).toEqual({ index: 5, type: 'WithdrawNonceAccount', lamports: 1_000_000n });
  });

  it('decodes InitializeNonceAccount (index 6, Pubkey authorized)', () => {
    const buf = Buffer.alloc(36);
    buf.writeUInt32LE(6, 0);
    Buffer.from(SOME_PUBKEY).copy(buf, 4);
    const decoded = decodeSystemInstruction(buf);
    expect(decoded).toEqual({ index: 6, type: 'InitializeNonceAccount', authorized: bs58.encode(SOME_PUBKEY) });
  });

  it('decodes AuthorizeNonceAccount (index 7, Pubkey new_authorized)', () => {
    const buf = Buffer.alloc(36);
    buf.writeUInt32LE(7, 0);
    Buffer.from(SOME_PUBKEY).copy(buf, 4);
    const decoded = decodeSystemInstruction(buf);
    expect(decoded).toEqual({ index: 7, type: 'AuthorizeNonceAccount', newAuthorized: bs58.encode(SOME_PUBKEY) });
  });

  it('decodes Transfer (index 2, u64 lamports) for shape reference', () => {
    const buf = Buffer.alloc(12);
    buf.writeUInt32LE(2, 0);
    buf.writeBigUInt64LE(42n, 4);
    expect(decodeSystemInstruction(buf)).toEqual({ index: 2, type: 'Transfer', lamports: 42n });
  });

  it('reports an unrecognized index honestly as Other, never guessed', () => {
    expect(decodeSystemInstruction(Buffer.from([99, 0, 0, 0]))).toEqual({ index: 99, type: 'Other' });
  });

  it('rejects a buffer too short to hold the u32 index', () => {
    expect(() => decodeSystemInstruction(Buffer.alloc(2))).toThrow(SystemDecodeError);
  });

  it('rejects a WithdrawNonceAccount instruction missing its lamports arg', () => {
    expect(() => decodeSystemInstruction(Buffer.from([5, 0, 0, 0]))).toThrow(SystemDecodeError);
  });
});
