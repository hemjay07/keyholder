#!/usr/bin/env node

// File: packages/decoder/scripts/fetch-fixtures.js
// Purpose: Fetch real mainnet account data for testing
// [VERIFIED] — Uses public Solana RPC API

const https = require('https');
const fs = require('fs');
const path = require('path');

const RPC_ENDPOINT = 'api.mainnet-beta.solana.com';

/**
 * Make JSON-RPC request to Solana API
 */
function rpcCall(method, params) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify({
      jsonrpc: '2.0',
      id: Math.random().toString(36),
      method,
      params,
    });

    const options = {
      hostname: RPC_ENDPOINT,
      port: 443,
      path: '/',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload),
      },
      timeout: 30000,
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        try {
          const result = JSON.parse(data);
          if (result.error) {
            reject(new Error(`RPC error: ${result.error.message}`));
          } else {
            resolve(result.result);
          }
        } catch (e) {
          reject(new Error(`Failed to parse JSON: ${e.message}`));
        }
      });
    });

    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('RPC request timeout'));
    });

    req.write(payload);
    req.end();
  });
}

/**
 * Fetch account data
 */
async function getAccountInfo(address) {
  try {
    const result = await rpcCall('getAccountInfo', [address, { encoding: 'base64' }]);
    return result;
  } catch (e) {
    throw new Error(`Failed to fetch ${address}: ${e.message}`);
  }
}

/**
 * Save fixture
 */
function saveFixture(name, accountInfo) {
  const fixtureDir = path.join(__dirname, '..', 'test', 'fixtures');

  if (!fs.existsSync(fixtureDir)) {
    fs.mkdirSync(fixtureDir, { recursive: true });
  }

  const fixtureFile = path.join(fixtureDir, `${name}.json`);
  const metadata = {
    source: 'https://api.mainnet-beta.solana.com',
    fetched_at: new Date().toISOString(),
    data_size_bytes: accountInfo?.data?.[0]
      ? Buffer.from(accountInfo.data[0], 'base64').length
      : 0,
    data: accountInfo?.data,
    owner: accountInfo?.owner,
    lamports: accountInfo?.lamports,
    executable: accountInfo?.executable,
    rent_epoch: accountInfo?.rentEpoch,
  };

  fs.writeFileSync(fixtureFile, JSON.stringify(metadata, null, 2));
  const sizeKb = (metadata.data_size_bytes / 1024).toFixed(2);
  console.log(`✓ Saved fixture: ${name} (${sizeKb} KB)`);
}

/**
 * Main
 */
async function main() {
  console.log('Fetching real mainnet fixtures for decoder tests\n');

  // Test with known addresses
  // NOTE: These are example addresses and may not be valid
  // Real implementation would use verified Squads multisig addresses
  const fixtures = [
    // Example: Drift Security Council Squads multisig
    // This would need a real address
  ];

  if (fixtures.length === 0) {
    console.log('Note: Fixture addresses not configured.');
    console.log('To add fixtures, add verified multisig/ProgramData addresses and re-run.');
    console.log('\nExample usage:');
    console.log('  fixtures.push({ name: "drift-security-council-multisig", address: "..." })');
    return;
  }

  for (const fixture of fixtures) {
    try {
      console.log(`Fetching ${fixture.name}...`);
      const accountInfo = await getAccountInfo(fixture.address);

      if (accountInfo) {
        saveFixture(fixture.name, accountInfo);
      } else {
        console.warn(`  ✗ Account not found or returned null`);
      }
    } catch (e) {
      console.error(`  ✗ Error: ${e.message}`);
    }

    // Rate limiting
    await new Promise(r => setTimeout(r, 1000));
  }

  console.log('\nFixture fetch complete.');
}

main().catch(e => {
  console.error('Fatal error:', e.message);
  process.exit(1);
});
