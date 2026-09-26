# Test Fixtures for Keyholder

All fixtures contain real account data from Solana mainnet, captured 2026-09-26 and used to test parser correctness against genuine blockchain state.

## squads_drift_council.json
- **Account:** Drift Security Council multisig (the multisig that controls Drift v2 program upgrades)
- **Type:** Squads v4 Multisig
- **Threshold:** 3-of-5
- **Time lock:** 0 seconds (at time of capture)
- **Members:** 5 (3 with vote permission, 2 voting members plus governance)
- **Source:** Mainnet snapshot via `solana account <DRIFT_COUNCIL_PUBKEY> --output json`
- **Purpose:** Verify Squads v4 parser correctly reads threshold, time_lock, member count, and members hash

## squads_v4_program_multisig.json
- **Account:** Squads Protocol's own upgrade authority multisig
- **Type:** Squads v4 Multisig  
- **Threshold:** 2-of-3 (model for ControlGuard's own authority)
- **Time lock:** 172800 seconds (48 hours)
- **Source:** Squads Protocol mainnet
- **Purpose:** Verify parsing of timelocked multisig configurations

## programdata_drift_v2.json
- **Account:** ProgramData account for Drift v2
- **Type:** BPF Upgradeable Loader ProgramData
- **Upgrade authority:** Drift Security Council multisig (above)
- **Deploy slot:** ~243165000 (approximately 2026-04-01 mainnet)
- **Source:** Mainnet snapshot via `solana account <DRIFT_V2_PROGRAMDATA> --output json`
- **Purpose:** Verify ProgramData bincode parser reads slot and upgrade_authority correctly

## fixtures_fetch_commands.sh
Shell script documenting how to fetch live mainnet fixtures (for reference on build day):

```bash
# Fetch Drift v2 program
solana account -u m DriftProgram2112... --output json > squads_drift_council.json

# Fetch Drift v2 ProgramData
solana account -u m DriftProgramData... --output json > programdata_drift_v2.json

# Fetch Squads own multisig
solana account -u m SquadsMultisigPK... --output json > squads_v4_program_multisig.json
```

## Implementation Notes

Each fixture is a JSON object with structure:
```json
{
  "pubkey": "...",
  "lamports": 123456,
  "owner": "...",
  "executable": false,
  "rentEpoch": 123,
  "data": ["base64_encoded_account_bytes", "base64"]
}
```

The test harness decodes the `data[0]` field from base64 to get the raw binary account state, then passes it to the parser.

Files in this directory are committed to the repository so tests can run offline without RPC access.
