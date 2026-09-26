// File: apps/web/src/app/layout.tsx
// Minimal root layout. Phase 4 scope is the API layer; page UI is out of
// scope for this phase (SURFACE kit owns presentation — see design/CONTEXT.md).

import type { ReactNode } from 'react';

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
