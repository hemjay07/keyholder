"use client";
// One nav for every page. Each entry leads somewhere distinct and is named for
// what the reader gets there.
import Link from "next/link";
import { usePathname } from "next/navigation";

const ITEMS = [
  { href: "/feed", label: "Changes" },
  { href: "/wallet", label: "Your wallet" },
  { href: "/replay/drift", label: "Drift replay" },
  { href: "/alerts", label: "Alerts" },
  { href: "/policy", label: "For vaults" },
  { href: "/proof", label: "Proof" },
];

export default function SiteNav() {
  const path = usePathname();
  return (
    <nav className="site-nav" aria-label="Keyholder">
      <Link href="/" className={`site-home${path === "/" ? " on" : ""}`} aria-label="Keyholder home">
        <svg className="site-mark" viewBox="0 0 50 20" width="40" height="16" aria-hidden="true">
          <rect x="0.75" y="0.75" width="48.5" height="18.5" rx="3.6" fill="none" stroke="currentColor" strokeWidth="1.5" />
          <rect x="4" y="8.25" width="7" height="3.5" rx="1.75" fill="currentColor" />
          <rect x="12.5" y="8.25" width="7" height="3.5" rx="1.75" fill="currentColor" />
          <rect x="22.25" y="4.5" width="3.5" height="11" rx="1.75" fill="currentColor" />
          <rect x="29.25" y="4.5" width="3.5" height="11" rx="1.75" fill="currentColor" />
          <rect x="36.25" y="4.5" width="3.5" height="11" rx="1.75" fill="currentColor" />
          <circle cx="44.6" cy="10" r="2.3" fill="#FF5A1F" />
        </svg>
        <span>KEYHOLDER</span>
      </Link>
      <div className="site-links">
        {ITEMS.map((i) => (
          <Link key={i.href} href={i.href} className={path?.startsWith(i.href) ? "on" : undefined} aria-current={path?.startsWith(i.href) ? "page" : undefined}>
            {i.label}
          </Link>
        ))}
      </div>
    </nav>
  );
}
