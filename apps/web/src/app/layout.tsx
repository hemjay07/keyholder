// File: apps/web/src/app/layout.tsx
// Root layout: fonts (design/TOKENS.css: Geist / Geist Mono) and the token stylesheet.

import type { ReactNode } from 'react';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';
import SiteNav from '@/components/SiteNav';
import SmoothScroll from '@/components/SmoothScroll';

const geist = Geist({ subsets: ['latin'], variable: '--font-geist', weight: ['400'] });
const geistMono = Geist_Mono({ subsets: ['latin'], variable: '--font-geist-mono', weight: ['400'] });

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
        {children}
      </body>
    </html>
  );
}
