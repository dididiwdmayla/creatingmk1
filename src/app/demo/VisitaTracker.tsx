"use client";

import { useEffect, useRef } from "react";

import { DEVICE_STORAGE_KEY, deviceIdValido } from "@/lib/device";

/**
 * Mede duração e profundidade de scroll da visita registrada pelo Server
 * Component (ver [leadId]/page.tsx) e manda via sendBeacon no unload —
 * POST /api/demo-visita, rota pública (ver proxy.ts). Best-effort: sem
 * sendBeacon ou aba fechada à força, a visita fica sem duração/scroll (o
 * registro em si já existe, gravado no carregamento).
 *
 * Também manda o marcador de dispositivo do localStorage (ver
 * lib/device.ts) — se presente, promove a visita a interna mesmo quando o
 * carregamento inicial não viu nem sessão nem o cookie do marcador (ex.:
 * cookie bloqueado no navegador embutido de um app, mas localStorage
 * sobrevive).
 */
export function VisitaTracker({ leadId, visitaId }: { leadId: string; visitaId: string }) {
  const inicioRef = useRef(0);
  const scrollMaxRef = useRef(0);

  useEffect(() => {
    inicioRef.current = Date.now();

    function medirScroll() {
      const alturaRolavel = document.documentElement.scrollHeight - window.innerHeight;
      const percent =
        alturaRolavel > 0 ? Math.min(100, Math.round((window.scrollY / alturaRolavel) * 100)) : 100;
      if (percent > scrollMaxRef.current) scrollMaxRef.current = percent;
    }

    function enviarBeacon() {
      if (!navigator.sendBeacon) return;
      const duracaoSegundos = Math.round((Date.now() - inicioRef.current) / 1000);
      let deviceId: string | undefined;
      try {
        const armazenado = localStorage.getItem(DEVICE_STORAGE_KEY);
        if (deviceIdValido(armazenado)) deviceId = armazenado;
      } catch {
        // localStorage indisponível — segue sem o marcador.
      }
      const payload = JSON.stringify({
        leadId,
        visitaId,
        duracaoSegundos,
        scrollPercent: scrollMaxRef.current,
        ...(deviceId && { deviceId }),
      });
      navigator.sendBeacon("/api/demo-visita", new Blob([payload], { type: "application/json" }));
    }

    function aoTrocarVisibilidade() {
      if (document.visibilityState === "hidden") enviarBeacon();
    }

    medirScroll();
    window.addEventListener("scroll", medirScroll, { passive: true });
    document.addEventListener("visibilitychange", aoTrocarVisibilidade);
    window.addEventListener("pagehide", enviarBeacon);
    return () => {
      window.removeEventListener("scroll", medirScroll);
      document.removeEventListener("visibilitychange", aoTrocarVisibilidade);
      window.removeEventListener("pagehide", enviarBeacon);
    };
  }, [leadId, visitaId]);

  return null;
}
