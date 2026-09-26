import { describe, expect, it } from 'vitest';
import { isControlRelevant } from './decode';

// Kinds observed in the live mainnet run of 2026-09-26.
describe('isControlRelevant', () => {
  it('happy: upgrades, authority moves and multisig executions trigger a state read', () => {
    for (const k of ['upgrade', 'set_authority', 'vault_transaction_execute', 'execute_transaction', 'batch_execute_transaction', 'config_transaction_execute']) {
      expect(isControlRelevant(k)).toBe(true);
    }
  });
  it('edge: votes, proposals and buffer growth do not', () => {
    for (const k of ['proposal_approve', 'proposal_create', 'proposal_reject', 'vault_transaction_create', 'extend_program']) {
      expect(isControlRelevant(k)).toBe(false);
    }
  });
  it('error: an undecoded or empty kind does not trigger a read', () => {
    expect(isControlRelevant('account_changed_undecoded')).toBe(false);
    expect(isControlRelevant('')).toBe(false);
  });
});
