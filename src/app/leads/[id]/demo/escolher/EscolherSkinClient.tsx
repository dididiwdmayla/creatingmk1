"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { NIVEIS_IA, NIVEL_IA_PADRAO, type NivelIA } from "@/lib/ai/nivel";
import { ApiError, api } from "@/lib/api-client";
import { SKINS } from "@/lib/demos/registry";
import type { Lead } from "@/lib/leads/types";

/** Rótulo + explicação curta de cada nível de intervenção da IA (ver lib/ai/nivel.ts). */
const NIVEL_INFO: Record<NivelIA, { rotulo: string; descricao: string }> = {
  "toque-leve": { rotulo: "Toque leve", descricao: "Só paleta e fonte — nenhum texto." },
  equilibrado: {
    rotulo: "Equilibrado",
    descricao: "Paleta, fonte, animação + slogan e descrições curtas.",
  },
  completo: {
    rotulo: "Completo",
    descricao:
      "Tudo do equilibrado + reescreve os textos de todas as seções no tom do nicho e no idioma da região.",
  },
};

/**
 * Passo de escolha da skin base, antes de criar a demo (ver Skin.tsx dos
 * templates + SkinDefinition.thumbnail): um card por skin registrada, com
 * miniatura e nome do nicho. Se o lead JÁ tem demo salva, o skin já foi
 * escolhido — pula direto pro editor (a troca de skin continua disponível
 * lá, na aba Tema).
 */
export function EscolherSkinClient({ id }: { id: string }) {
  const router = useRouter();
  const [lead, setLead] = useState<Lead | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  // IA na Forja: checkbox só aparece com GEMINI_API_KEY configurada.
  const [iaDisponivel, setIaDisponivel] = useState<boolean | null>(null);
  const [comIA, setComIA] = useState(false);
  // Nível de intervenção escolhido — pré-selecionado com o último que o
  // próprio usuário usou (GET /api/ia/nivel); persistido a cada troca.
  const [nivelIA, setNivelIA] = useState<NivelIA>(NIVEL_IA_PADRAO);

  useEffect(() => {
    let ignore = false;
    api
      .iaStatus()
      .then(({ disponivel }) => {
        if (!ignore) setIaDisponivel(disponivel);
      })
      .catch(() => {
        if (!ignore) setIaDisponivel(false);
      });
    api
      .iaNivel()
      .then(({ nivel }) => {
        if (!ignore) setNivelIA(nivel);
      })
      .catch(() => {
        /* sem sessão/erro: mantém o padrão já no estado inicial. */
      });
    return () => {
      ignore = true;
    };
  }, []);

  function handleNivelChange(nivel: NivelIA) {
    setNivelIA(nivel);
    api.salvarIaNivel(nivel).catch(() => {
      /* preferência não salvou — a escolha desta sessão continua valendo. */
    });
  }

  useEffect(() => {
    let ignore = false;
    api
      .getLead(id)
      .then(({ lead: leadData }) => {
        if (ignore) return;
        if (leadData.demo) {
          router.replace(`/leads/${id}/demo/editar`);
          return;
        }
        setLead(leadData);
      })
      .catch((error) => {
        if (ignore) return;
        if (error instanceof ApiError && error.code === "not_found") setNotFound(true);
        else setErro(error instanceof ApiError ? error.message : "Falha ao carregar o lead.");
      });
    return () => {
      ignore = true;
    };
  }, [id, router]);

  if (notFound || erro) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-3 bg-background text-foreground">
        <p className="text-sm text-ink-muted">{notFound ? "Lead não encontrado." : erro}</p>
        <Link href="/leads" className="text-sm text-accent">
          Voltar para leads
        </Link>
      </div>
    );
  }

  if (!lead) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-background">
        <p className="text-sm text-ink-muted">Carregando…</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-dvh flex-col items-center bg-background px-4 py-10 text-foreground">
      <div className="w-full max-w-4xl">
        <Link href={`/leads/${id}`} className="text-xs text-ink-muted hover:text-foreground">
          ← Ficha de {lead.nome}
        </Link>
        <h1 className="mt-3 text-xl font-semibold">Escolha o template da demo</h1>
        <p className="mt-1 text-sm text-ink-muted">
          Cada skin é um site completo, com seções e tema próprios — dá pra trocar depois na aba
          Tema do editor, mas já sai daqui com uma base fiel ao nicho do negócio.
        </p>

        {iaDisponivel === true ? (
          <div className="mt-4 rounded-lg border border-line bg-surface p-3 text-sm text-foreground">
            <label className="flex cursor-pointer items-start gap-2">
              <input
                type="checkbox"
                checked={comIA}
                onChange={(e) => setComIA(e.target.checked)}
                className="mt-0.5 accent-[var(--accent)]"
              />
              <span>
                ✨ Começar com sugestões de IA
                <span className="block text-xs text-ink-muted">
                  O Gemini sugere um ponto de partida pra demo — você escolhe o quanto ele pode
                  mexer, revisa e aplica (ou descarta) antes de salvar.
                </span>
              </span>
            </label>
            {comIA && (
              <div className="mt-3 flex flex-col gap-2 border-t border-line pt-3">
                {NIVEIS_IA.map((valor) => (
                  <label
                    key={valor}
                    className={`flex cursor-pointer items-start gap-2 rounded-lg border p-2.5 text-sm transition-colors ${
                      nivelIA === valor
                        ? "border-accent bg-surface-2"
                        : "border-line hover:border-accent/50"
                    }`}
                  >
                    <input
                      type="radio"
                      name="nivel-ia"
                      checked={nivelIA === valor}
                      onChange={() => handleNivelChange(valor)}
                      className="mt-0.5 accent-[var(--accent)]"
                    />
                    <span>
                      {NIVEL_INFO[valor].rotulo}
                      <span className="block text-xs text-ink-muted">
                        {NIVEL_INFO[valor].descricao}
                      </span>
                    </span>
                  </label>
                ))}
              </div>
            )}
          </div>
        ) : (
          iaDisponivel === false && (
            <p className="mt-4 text-xs text-ink-muted">
              Sugestões de IA indisponíveis — configure GEMINI_API_KEY no servidor para ativar.
            </p>
          )
        )}

        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
          {SKINS.map((skin) => (
            <Link
              key={skin.id}
              href={`/leads/${id}/demo/editar?skin=${skin.id}${comIA ? `&ia=1&nivel=${nivelIA}` : ""}`}
              className="group flex flex-col overflow-hidden rounded-lg border border-line bg-surface transition-colors hover:border-accent"
            >
              <span className="relative aspect-[4/3] w-full overflow-hidden bg-surface-2">
                <Image
                  src={skin.thumbnail}
                  alt={`Miniatura: ${skin.nome}`}
                  fill
                  unoptimized
                  className="object-cover transition-transform group-hover:scale-[1.03]"
                />
              </span>
              <span className="flex flex-col gap-1 p-4">
                <span className="text-[11px] font-medium uppercase tracking-wide text-accent">
                  {skin.nicho}
                </span>
                <span className="text-base font-semibold text-foreground">{skin.nome}</span>
                {skin.descricao && (
                  <span className="text-xs text-ink-muted">{skin.descricao}</span>
                )}
              </span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
