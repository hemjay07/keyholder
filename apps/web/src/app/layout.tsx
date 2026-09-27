// File: apps/web/src/app/layout.tsx
// Root layout: fonts (design/TOKENS.css: Geist / Geist Mono) and the token stylesheet.

import type { ReactNode } from 'react';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';
import SiteNav from '@/components/SiteNav';

const geist = Geist({ subsets: ['latin'], variable: '--font-geist', weight: ['400'] });
const geistMono = Geist_Mono({ subsets: ['latin'], variable: '--font-geist-mono', weight: ['400'] });

export const metadata = {
  title: 'Keyholder',
  description: 'Keyholder shows who can move the money in every Solana protocol.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${geist.variable} ${geistMono.variable}`}>
      <body>
        <SiteNav />
        {children}
      </body>
    </html>
  );
}
