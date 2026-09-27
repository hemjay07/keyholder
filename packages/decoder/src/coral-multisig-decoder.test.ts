// Tested against real mainnet bytes: Marinade's upgrade-authority multisig,
// captured 2026-09-27 (data/fixtures-for-decoder/coral-multisig-marinade.json
// records the method and slot).
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { CORAL_MULTISIG_PROGRAM_ID, parseCoralMultisig, coralMultisigSigner } from './coral-multisig-decoder';
import { DiscriminatorMismatchError, TruncatedBufferError } from './errors';

const fixture = JSON.parse(
  readFileSync(join(__dirname, '..', '..', '..', 'data', 'fixtures-for-decoder', 'coral-multisig-marinade.json'), 'utf8')
) as { address: string; owner: string; signerPda: string; dataBase64: string };
const data = Buffer.from(fixture.dataBase64, 'base64');

describe('coral multisig decoder', () => {
  it('happy: parses the real Marinade multisig: 6 of 13, nonce 253', () => {
    expect(fixture.owner).toBe(CORAL_MULTISIG_PROGRAM_ID);
    const ms = parseCoralMultisig(data);
    expect(ms.owners).toHaveLength(13);
    expect(ms.threshold).toBe(6);
    expect(ms.nonce).toBe(253);
    expect(new Set(ms.owners).size).toBe(13);
  });

  it('happy: the signer PDA derived from the account is Marinade\'s upgrade authority', () => {
    const ms = parseCoralMultisig(data);
    expect(coralMultisigSigner(fixture.address, ms.nonce)).toBe(fixture.signerPda);
  });

  it('edge: a buffer cut inside the owners vector is truncated, not misread', () => {
    expect(() => parseCoralMultisig(data.subarray(0, 12 + 32 * 5))).toThrow(TruncatedBufferError);
  });

  it('error: another account type (wrong discriminator) is refused', () => {
    const other = Buffer.from(data);
    other[0] = other[0]! ^ 0xff;
    expect(() => parseCoralMultisig(other)).toThrow(DiscriminatorMismatchError);
  });
});
