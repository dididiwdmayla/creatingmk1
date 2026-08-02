"use client";

import { useEffect, useState } from "react";

import { paletaParaAura } from "@/lib/demos/efeitos/aura/cores";
import { getEfeitoComponenteDinamico } from "@/lib/demos/efeitos/dynamicComponents";
import { resolverEfeitoFundo } from "@/lib/demos/efeitos/registry";
import { getSkin } from "@/lib/demos/registry";
import type { DemoData, TemaPatch, Theme } from "@/lib/demos/types";
import { demoCoreFontsClassName, resolveExtraFontClassNames } from "../demo/fonts";

/**
 * Preview AO VIVO do editor de demos — carregada num iframe por
 * /leads/[id]/demo/editar. Não lê nada do banco: o editor manda o estado
 * completo (skinId + DemoData + Theme já montados) por postMessage a cada
 * mudança, e esta página só renderiza a skin. Rota protegida por senha
 * como o resto do app (só /demo/{leadId} é pública).
 *
 * No caminho contrário, clique em qualquer elemento com data-demo-slot
 * (os slots que a skin marca) devolve o caminho do slot ao editor — que
 * abre e foca o campo correspondente do painel.
 */

interface PreviewState {
  skinId: string;
  data: DemoData;
  theme: Theme;
  tema?: TemaPatch;
  idioma?: string;
  moeda?: string;
}

const MSG_PREVIEW = "radar-demo-preview";
const MSG_SLOT = "radar-demo-slot";
const MSG_PRONTO = "radar-demo-preview-pronto";

export default function DemoPreviewPage() {
  const [estado, setEstado] = useState<PreviewState | null>(null);
  const [extraFontClassName, setExtraFontClassName] = useState("");

  useEffect(() => {
    function onMessage(event: MessageEvent) {
      if (event.origin !== window.location.origin) return;
      const msg = event.data as { tipo?: string } & Partial<PreviewState>;
      if (msg?.tipo === MSG_PREVIEW && msg.skinId && msg.data && msg.theme) {
        setEstado({
          skinId: msg.skinId,
          data: msg.data,
          theme: msg.theme,
          tema: msg.tema,
          idioma: msg.idioma,
          moeda: msg.moeda,
        });
      }
    }
    window.addEventListener("message", onMessage);
    // Avisa o editor que o iframe está pronto para receber o estado.
    window.parent.postMessage({ tipo: MSG_PRONTO }, window.location.origin);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  // Import dinâmico só da fonte escolhida no editor — o resto da lista
  // curada nunca chega a ser buscado neste preview.
  useEffect(() => {
    let ignore = false;
    resolveExtraFontClassNames([estado?.tema?.fonteDisplay, estado?.tema?.fonteCorpo]).then(
      (classe) => {
        if (!ignore) setExtraFontClassName(classe);
      },
    );
    return () => {
      ignore = true;
    };
  }, [estado?.tema?.fonteDisplay, estado?.tema?.fonteCorpo]);

  useEffect(() => {
    // Clique em slot → foca o campo no painel do editor. Capture para
    // vencer os links/CTAs da skin (no preview eles não devem navegar).
    function onClick(event: MouseEvent) {
      const alvo = (event.target as HTMLElement | null)?.closest?.("[data-demo-slot]");
      event.preventDefault();
      if (!(alvo instanceof HTMLElement)) return;
      event.stopPropagation();
      window.parent.postMessage(
        { tipo: MSG_SLOT, slot: alvo.dataset.demoSlot },
        window.location.origin,
      );
    }
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);

  const skin = getSkin(estado?.skinId);
  if (!estado || !skin) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <p className="text-sm text-ink-muted">Carregando prévia…</p>
      </div>
    );
  }

  const Skin = skin.componente;
  // Mesma resolução da rota pública (ver /demo/[leadId]/page.tsx) — o
  // preview fica fiel ao que será publicado, inclusive o efeito de fundo.
  const efeitoFundo = resolverEfeitoFundo(
    estado.theme.fundoEfeito,
    estado.tema?.fundoEfeitoIntensidade,
    skin.nicho,
  );
  const EfeitoFundo = efeitoFundo ? getEfeitoComponenteDinamico(efeitoFundo.efeito.id) : undefined;
  // Mesma resolução da rota pública (ver /demo/[leadId]/page.tsx#loadDemo).
  const coresEfeito =
    efeitoFundo?.efeito.id === "aura"
      ? paletaParaAura(estado.theme.paleta, estado.tema?.auraCores)
      : estado.theme.paleta;
  return (
    <div className={`${demoCoreFontsClassName} ${extraFontClassName}`}>
      {/* Affordance de edição: qualquer slot clicável ganha contorno no hover. */}
      <style>{`
        [data-demo-slot] { cursor: pointer; }
        [data-demo-slot]:hover {
          outline: 2px dashed color-mix(in srgb, ${estado.theme.paleta.destaque} 80%, transparent);
          outline-offset: 4px;
        }
      `}</style>
      <Skin data={estado.data} theme={estado.theme} idioma={estado.idioma} moeda={estado.moeda} />
      {EfeitoFundo && efeitoFundo && (
        // EfeitoFundo vem de um lookup em mapa de componentes já criados
        // (dynamicComponents.ts, module scope) — não é criado a cada render.
        // eslint-disable-next-line react-hooks/static-components
        <EfeitoFundo intensidade={efeitoFundo.intensidade} cores={coresEfeito} />
      )}
    </div>
  );
}
