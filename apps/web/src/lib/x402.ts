// File: apps/web/src/lib/x402.ts
// x402 resource server wiring. Deviation from arch/D-web.md §7: that section
// invented `new ExactSvmScheme({ network, connection, facilitatorPublicKey,
// mint })`, which is not the real @x402/svm@2.27.0 API. The installed
// package's .d.ts (checked directly, see BUILD-REPORT DEV-006 pattern)
// shows three different `ExactSvmScheme` classes — client, facilitator, and
// resource-server (`@x402/svm/exact/server`) — plus a `registerExactSvmScheme`
// helper. Since PayAI is the facilitator (it holds the signer and does
// verify/settle over HTTP), the resource server only needs `HTTPFacilitatorClient`
// pointed at PayAI and the resource-server-side exact/server scheme
// registered for the Solana mainnet CAIP-2 network id.
//
// Network id source: `@x402/svm`'s own `SOLANA_MAINNET_CAIP2` constant equals
// "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp" — confirmed by reading the
// installed package, matching arch/D-web.md §7's cited value.

import { x402ResourceServer, HTTPFacilitatorClient } from '@x402/core/server';
import { registerExactSvmScheme } from '@x402/svm/exact/server';
import { env } from './env';

export const SOLANA_NETWORK_ID = 'solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp' as const;

export const USDC_MAINNET_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';

let server: x402ResourceServer | null = null;

/**
 * The shared x402 resource server, pointed at the PayAI facilitator
 * (https://facilitator.payai.network — no API key required for verify/settle).
 */
export function getX402Server(): x402ResourceServer {
  if (!server) {
    const facilitatorClient = new HTTPFacilitatorClient({ url: env.X402_FACILITATOR_URL });
    server = new x402ResourceServer(facilitatorClient);
    registerExactSvmScheme(server, { networks: [SOLANA_NETWORK_ID], rpcUrl: env.SOLANA_RPC_URL });
  }
  return server;
}

/** The address that receives x402 payments. Public key only — see
 * ~/.config/keyholder/receiver.json (mode 600) for the keypair; its secret
 * is never read by this app. */
export function payToAddress(): string {
  const addr = env.X402_PAYTO_ADDRESS;
  if (!addr) {
    throw new Error('X402_PAYTO_ADDRESS is not set');
  }
  return addr;
}
