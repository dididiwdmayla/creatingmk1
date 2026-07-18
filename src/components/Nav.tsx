"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

import { api } from "@/lib/api-client";
import { ThemeToggle } from "./ThemeToggle";

const TABS = [
  { href: "/", label: "Painel" },
  { href: "/leads", label: "Leads" },
  { href: "/buscas", label: "Buscas" },
  { href: "/demos", label: "Demos" },
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
        <span className="flex items-center gap-2">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-60" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-accent" />
          </span>
          <span className="font-display text-base font-bold tracking-[0.15em] text-foreground">
            RADAR
          </span>
        </span>
        <span className="flex items-center gap-4">
          <ThemeToggle />
          <button
            type="button"
            onClick={handleLogout}
            disabled={signingOut}
            className="text-xs font-medium text-ink-muted hover:text-foreground disabled:opacity-50"
          >
            {signingOut ? "Saindo…" : "Sair"}
          </button>
        </span>
      </header>

      <nav className="fixed inset-x-0 bottom-0 z-10 border-t border-line bg-surface pb-[env(safe-area-inset-bottom)]">
        <div className="mx-auto flex max-w-lg">
          {TABS.map((tab) => {
            const active = isActive(pathname, tab.href);
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={`relative flex-1 py-3 text-center text-sm font-medium transition-colors ${
                  active ? "text-accent" : "text-ink-muted hover:text-ink-secondary"
                }`}
              >
                {tab.label}
                {active && (
                  <span className="absolute inset-x-3 -top-px h-0.5 rounded-full bg-accent shadow-[0_0_8px_var(--accent)]" />
                )}
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
