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
      <Link href="/" className={`site-home${path === "/" ? " on" : ""}`}>Keyholder</Link>
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
