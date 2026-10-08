// scripts/sign-claim.ts
// Sign a Keyholder Proof of Control claim with a key that controls the program (its upgrade key, or a member of the
// multisig that controls its upgrade). The secret key never leaves this machine; only the signature is published.
//
//   npx tsx scripts/sign-claim.ts claim.json ~/.config/solana/id.json > signed.json
//   curl -X POST https://keyholder-ashy.vercel.app/api/v1/claims -H 'content-type: application/json' --data @signed.json
//
// claim.json: { "version": "keyholder-claim/v1", "protocol": "<name>", "issuedAt": "YYYY-MM-DD",
//   "programs": [{ "programId": "<id>", "upgrade": { "kind": "multisig", "threshold": { "min": 5 }, "timelockS": { "min": 86400 } } }] }
// Publish it: open a pull request adding signed.json to data/claims/. From then it is checked every day.
import { readFileSync } from 'node:fs';
import { signClaim, type ClaimBody } from '../apps/worker/src/records/claims';

const [claimPath, keyPath] = process.argv.slice(2);
if (!claimPath || !keyPath) { console.error('usage: sign-claim.ts <claim.json> <keypair.json>'); process.exit(1); }
const body = JSON.parse(readFileSync(claimPath, 'utf8')) as ClaimBody;
const secret = Uint8Array.from(JSON.parse(readFileSync(keyPath, 'utf8')) as number[]);
process.stdout.write(JSON.stringify(signClaim(body, secret), null, 1) + '\n');
