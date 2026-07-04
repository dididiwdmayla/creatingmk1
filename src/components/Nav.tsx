"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

import { api } from "@/lib/api-client";

const TABS = [
  { href: "/", label: "Painel" },
  { href: "/leads", label: "Leads" },
  { href: "/buscas", label: "Buscas" },
  { href: "/config", label: "Config" },
] as const;

function isActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function Nav() {
  const pathname = usePathname();
  const [signingOut, setSigningOut] = useState(false);

  async function handleLogout() {
    setSigningOut(true);
    try {
      await api.logout();
    } finally {
      window.location.href = "/login";
    }
  }

  return (
    <>
      <header className="flex items-center justify-between border-b border-line bg-surface px-4 py-3">
        <span className="font-mono text-sm font-semibold tracking-[0.2em] text-ink-secondary">
          RADAR
        </span>
        <button
          type="button"
          onClick={handleLogout}
          disabled={signingOut}
          className="text-xs font-medium text-ink-muted hover:text-foreground disabled:opacity-50"
        >
          {signingOut ? "Saindo…" : "Sair"}
        </button>
      </header>

      <nav className="fixed inset-x-0 bottom-0 z-10 border-t border-line bg-surface pb-[env(safe-area-inset-bottom)]">
        <div className="mx-auto flex max-w-lg">
          {TABS.map((tab) => {
            const active = isActive(pathname, tab.href);
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={`flex-1 py-3 text-center text-sm font-medium transition-colors ${
                  active ? "text-accent" : "text-ink-muted hover:text-ink-secondary"
                }`}
              >
                {tab.label}
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
