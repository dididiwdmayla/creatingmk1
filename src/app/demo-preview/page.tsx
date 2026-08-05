"use client";

import { useEffect, useState } from "react";

import { resolverCamadaEfeito } from "@/lib/demos/efeitos/camada";
import { EfeitoCamada } from "@/lib/demos/efeitos/EfeitoCamada";
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
 *
 * O que este preview DELIBERADAMENTE não monta é o `BarraNavegador` (a
 * cor da barra acompanhando a seção — ver lib/demos/barra): a barra do
 * navegador obedece ao documento de CIMA, e esta página é um iframe.
 * Montá-lo aqui escreveria numa meta tag que nenhum navegador lê,
 * gastando um listener de scroll por quadro pra nada — e, pior, daria a
 * impressão de que o preview mostra a barra. Quem mostra a cor escolhida
 * é a AMOSTRA no painel do editor (`BarraCorControl` em paineis.tsx).
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
  // Só para o PRIMEIRO desenho: sem isso, a skin pinta com a fonte core (ou
  // nenhuma, se a var ainda não existe) e troca de fonte assim que o import
  // dinâmico da fonte escolhida resolve — reflow de texto depois do
  // primeiro desenho, o defeito que este estado existe para evitar. Trocas
  // de fonte já em edição (o usuário mexendo na aba Tema) não passam por
  // aqui de novo: `jaMostrou` já travou em true e o preview segue ao vivo.
  const [jaMostrou, setJaMostrou] = useState(false);

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
        if (ignore) return;
        setExtraFontClassName(classe);
        setJaMostrou(true);
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
  if (!estado || !skin || !jaMostrou) {
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
  // Mesma resolução da rota pública (ver /demo/[leadId]/page.tsx#loadDemo).
  const camada = resolverCamadaEfeito({
    paleta: estado.theme.paleta,
    efeitoId: efeitoFundo?.efeito.id,
    efeitoCores: estado.theme.efeitoCores,
    auraCores: estado.tema?.auraCores,
  });
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
      {efeitoFundo && (
        <EfeitoCamada
          id={efeitoFundo.efeito.id}
          intensidade={efeitoFundo.intensidade}
          cores={camada.cores}
          coresCss={camada.coresCss}
          coresAnimacao={camada.coresAnimacao}
        />
      )}
    </div>
  );
}
