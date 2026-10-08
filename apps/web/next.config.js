/** @type {import('next').NextConfig} */
const path = require('path');
// Monorepo: the workspace root (pnpm-lock.yaml, node_modules) is two levels up.
// Explicit so builds that start in apps/web (vercel build) still resolve next.
const root = path.join(__dirname, '..', '..');
const nextConfig = {
  reactStrictMode: true,
  turbopack: { root },
  outputFileTracingRoot: root,
  // Revamp 3 routes: /feed became /changes (2026-10-08).
  async redirects() {
    return [{ source: '/feed', destination: '/changes', permanent: true }];
  },
  async headers() {
    return [
      {
        source: '/api/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
        ],
      },
      {
        source: '/api/v1/feed/stream',
        headers: [
          { key: 'Cache-Control', value: 'no-cache, no-store' },
          { key: 'Connection', value: 'keep-alive' },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
