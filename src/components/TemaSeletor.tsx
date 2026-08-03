"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";

import { api } from "@/lib/api-client";
import {
  TEMAS_APP,
  TEMAS_META,
  TEMA_PADRAO,
  temaOuPadrao,
  type TemaApp,
} from "@/lib/tema";

/**
 * O tema ATIVO vive no DOM (`data-theme` no <html>, já renderizado pelo
 * servidor a partir do cookie-espelho) — o componente só espelha esse
 * estado externo via useSyncExternalStore, sem setState em efeito. Mesmo
 * desenho do antigo ThemeToggle, agora com N temas em vez de um booleano.
 */
let listeners: Array<() => void> = [];

function subscribe(listener: () => void): () => void {
  listeners.push(listener);
  return () => {
    listeners = listeners.filter((l) => l !== listener);
  };
}

function lerDoDom(): TemaApp {
  return temaOuPadrao(document.documentElement.dataset.theme);
}

// No servidor o snapshot é o padrão; o valor real entra na hidratação.
// (O HTML em si já sai com o tema certo — isto é só o glifo do botão.)
function noServidor(): TemaApp {
  return TEMA_PADRAO;
}

function aplicarNoDom(tema: TemaApp): void {
  document.documentElement.dataset.theme = tema;
  // A barra do navegador acompanha a interface na hora, sem recarregar. O
  // valor inicial vem do `generateViewport` do layout (servidor); aqui só o
  // `content` é reescrito — a tag já existe, e criar uma segunda faria o
  // navegador considerar a primeira.
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", TEMAS_META[tema].barra);
  for (const listener of listeners) listener();
}

/**
 * Seletor do tema da PLATAFORMA, no header. A escolha é pessoal e mora no
 * doc do usuário (ver lib/tema.ts) — este componente é só a porta.
 *
 * Duas fontes, nesta ordem:
 *   1. o `data-theme` que o SERVIDOR já renderizou no <html> a partir do
 *      cookie-espelho — é o que aparece na primeira pintura, sem flash;
 *   2. `GET /api/tema` na montagem, que é a fonte da verdade (o doc) e
 *      corrige o cookie: cobre o caso de a escolha ter mudado em OUTRO
 *      dispositivo desde o último login deste navegador.
 *
 * A troca é otimista (aplica no DOM na hora, o PUT vai atrás) e reverte
 * se a rota falhar — mesmo padrão do toggle da MetaFaixa.
 */
export function TemaSeletor() {
  const tema = useSyncExternalStore(subscribe, lerDoDom, noServidor);
  const [aberto, setAberto] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const caixaRef = useRef<HTMLDivElement>(null);

  // Reconciliação com o doc (fonte da verdade). Só escreve no DOM — o
  // estado do componente sai do próprio DOM, não daqui.
  useEffect(() => {
    let ignore = false;
    api
      .getTema()
      .then(({ tema: doDoc }) => {
        if (!ignore) aplicarNoDom(doDoc);
      })
      .catch(() => {
        // O tema do cookie continua valendo: falha de rede não pode
        // repintar o app nem quebrar o header.
      });
    return () => {
      ignore = true;
    };
  }, []);

  // Fecha ao clicar fora / no Esc — o menu é um popover, não um modal.
  useEffect(() => {
    if (!aberto) return;
    function noDocumento(evento: MouseEvent) {
      if (!caixaRef.current?.contains(evento.target as Node)) setAberto(false);
    }
    function noTeclado(evento: KeyboardEvent) {
      if (evento.key === "Escape") setAberto(false);
    }
    document.addEventListener("mousedown", noDocumento);
    document.addEventListener("keydown", noTeclado);
    return () => {
      document.removeEventListener("mousedown", noDocumento);
      document.removeEventListener("keydown", noTeclado);
    };
  }, [aberto]);

  async function escolher(novo: TemaApp) {
    setAberto(false);
    if (novo === tema) return;
    const anterior = tema;
    aplicarNoDom(novo);
    setSalvando(true);
    try {
      await api.putTema(novo);
    } catch {
      aplicarNoDom(anterior);
    } finally {
      setSalvando(false);
    }
  }

  const atual = TEMAS_META[tema];

  return (
    <div ref={caixaRef} className="relative">
      <button
        type="button"
        onClick={() => setAberto((v) => !v)}
        disabled={salvando}
        aria-haspopup="menu"
        aria-expanded={aberto}
        aria-label={`Tema: ${atual.nome}. Trocar de tema`}
        title={`Tema: ${atual.nome}`}
        className="flex items-center gap-1.5 text-sm leading-none text-ink-muted transition-colors hover:text-foreground disabled:opacity-50"
      >
        <span aria-hidden>{atual.glifo}</span>
        <span aria-hidden className="text-[10px]">
          ▾
        </span>
      </button>

      {aberto && (
        <div
          role="menu"
          className="absolute right-0 top-full z-30 mt-2 w-56 overflow-hidden rounded-md border border-line bg-surface shadow-[0_12px_32px_-12px_rgba(0,0,0,0.6)]"
        >
          {TEMAS_APP.map((id) => {
            const meta = TEMAS_META[id];
            const ativo = id === tema;
            return (
              <button
                key={id}
                type="button"
                role="menuitemradio"
                aria-checked={ativo}
                onClick={() => escolher(id)}
                className={`flex w-full items-start gap-2.5 px-3 py-2 text-left transition-colors ${
                  ativo ? "bg-surface-2" : "hover:bg-surface-2"
                }`}
              >
                <span aria-hidden className="mt-px text-sm leading-none text-ink-secondary">
                  {meta.glifo}
                </span>
                <span className="min-w-0 flex-1">
                  <span
                    className={`block text-sm font-medium ${
                      ativo ? "text-accent" : "text-foreground"
                    }`}
                  >
                    {meta.nome}
                  </span>
                  <span className="mt-0.5 block text-[11px] leading-snug text-ink-muted">
                    {meta.descricao}
                  </span>
                </span>
                {/* Nunca só cor: o tema ativo também é marcado por glifo. */}
                <span aria-hidden className={`text-xs ${ativo ? "text-accent" : "opacity-0"}`}>
                  ✓
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
