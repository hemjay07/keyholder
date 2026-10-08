// File: apps/web/src/app/layout.tsx
// Root layout: fonts (design/TOKENS.css: Geist / Geist Mono) and the token stylesheet.

import type { ReactNode } from 'react';
import localFont from 'next/font/local';
import './globals.css';
import SiteNav from '@/components/SiteNav';
import CommandPalette from '@/components/CommandPalette';
import SmoothScroll from '@/components/SmoothScroll';

// Served from the repo (Geist-Latin.woff2.SOURCE.json): no build-time fetch from Google Fonts. Geist is variable.
const geist = localFont({ src: './Geist-Latin.woff2', variable: '--font-geist', weight: '100 900', display: 'swap' });
const geistMono = localFont({ src: './GeistMono-Regular.woff2', variable: '--font-geist-mono', weight: '400', display: 'swap' });

export const metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'),
  title: { default: 'Keyholder', template: '%s · Keyholder' },
  description: 'Keyholder shows who can move the money in every Solana protocol.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${geist.variable} ${geistMono.variable}`}>
      <body>
        <SmoothScroll />
        <SiteNav />
        <CommandPalette />
        {children}
      </body>
    </html>
  );
}
