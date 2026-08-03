"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

import { api } from "@/lib/api-client";
import { TemaSeletor } from "./TemaSeletor";

const TABS = [
  { href: "/hoje", label: "Hoje" },
  { href: "/", label: "Painel" },
  { href: "/leads", label: "Leads" },
  { href: "/buscas", label: "Buscas" },
  { href: "/demos", label: "Demos" },
  { href: "/mensagens", label: "Chat" },
  { href: "/config", label: "Config" },
] as const;

/** Cadência do polling do badge de não-lidas (leve, sem websocket). */
const NAO_LIDAS_POLL_MS = 30_000;

function isActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function Nav() {
  const pathname = usePathname();
  const [signingOut, setSigningOut] = useState(false);
  const [naoLidas, setNaoLidas] = useState(0);

  // Badge de não-lidas: polling leve + refetch ao trocar de página (sair
  // de /mensagens com a conversa lida zera o badge na hora).
  useEffect(() => {
    let ignore = false;
    function atualizar() {
      api
        .mensagensNaoLidas()
        .then(({ total }) => {
          if (!ignore) setNaoLidas(total);
        })
        .catch(() => {
          /* badge é acessório: falha de rede não pode quebrar a nav */
        });
    }
    atualizar();
    const timer = setInterval(atualizar, NAO_LIDAS_POLL_MS);
    return () => {
      ignore = true;
      clearInterval(timer);
    };
  }, [pathname]);

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
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-line bg-surface px-4">
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
          <TemaSeletor />
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
        <div className="mx-auto flex h-14 max-w-lg">
          {TABS.map((tab) => {
            const active = isActive(pathname, tab.href);
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={`relative flex flex-1 items-center justify-center text-sm font-medium transition-colors ${
                  active ? "text-accent" : "text-ink-muted hover:text-ink-secondary"
                }`}
              >
                <span className="relative inline-block">
                  {tab.label}
                  {tab.href === "/mensagens" && naoLidas > 0 && (
                    <span
                      aria-label={`${naoLidas} mensagem(ns) não lida(s)`}
                      className="absolute -right-3.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 text-[10px] font-bold leading-none text-accent-ink"
                    >
                      {naoLidas > 9 ? "9+" : naoLidas}
                    </span>
                  )}
                </span>
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
