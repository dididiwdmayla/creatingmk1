"use client";

import { useEffect, useState } from "react";

import { SkeletonRows } from "@/components/Skeleton";
import { PainelColapsavel } from "@/components/config/PainelColapsavel";
import { LimiteInput } from "@/components/config/comum";
import { ApiError, api, type MetasUsuariosResponse } from "@/lib/api-client";
import type { MetasUsuario } from "@/lib/usuarios/types";

/** Chave da persistência deste painel — ver `PainelColapsavel`. */
const PAINEL_METAS = "metas-usuarios";

const JANELAS_META: Array<{ chave: "dia" | "semana"; label: string; campo: keyof MetasUsuario }> = [
  { chave: "dia", label: "Hoje", campo: "prospeccoesDia" },
  { chave: "semana", label: "Semana", campo: "prospeccoesSemana" },
];

/** Mensagem de erro com o `code` da API — mesmo padrão de mensagemErroCotas. */
function mensagemErroMetas(error: unknown, fallback: string): string {
  return error instanceof ApiError ? `${fallback} (${error.code}): ${error.message}` : fallback;
}

/**
 * Metas de prospecção por integrante (admin): meta diária e semanal,
 * editáveis inline no mesmo padrão de CotasUsuariosSection (LimiteInput
 * reaproveitado, salva no blur). "Prospecção" = contador `buscas` de
 * usage_users (ver src/lib/usuarios/metas.ts) — o mesmo dado que a busca
 * já grava, sem nenhum contador novo. Meta é opcional: campo vazio = sem
 * meta, e a linha do usuário sem NENHUMA meta configurada não aparece em
 * lugar nenhum fora daqui (/hoje e o painel do admin escondem a janela sem
 * meta) — mas aqui ela continua listada, para o admin poder configurar.
 */
export function MetasUsuariosSection() {
  const [linhas, setLinhas] = useState<MetasUsuariosResponse["usuarios"] | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState<string | null>(null);

  useEffect(() => {
    let ignore = false;
    api
      .getMetasUsuarios()
      .then(({ usuarios }) => {
        if (!ignore) setLinhas(usuarios);
      })
      .catch((error) => {
        if (ignore) return;
        setErro(
          error instanceof ApiError && error.status === 403
            ? "Metas são restritas ao admin."
            : mensagemErroMetas(error, "Falha ao carregar as metas"),
        );
      });
    return () => {
      ignore = true;
    };
  }, []);

  async function salvarMeta(id: string, campo: keyof MetasUsuario, valor: number | null) {
    const chave = `${id}:${campo}`;
    setOcupado(chave);
    setErro(null);
    try {
      const { usuario } = await api.patchUsuario(id, { metas: { [campo]: valor } });
      setLinhas((atual) =>
        (atual ?? []).map((linha) =>
          linha.id === id ? { ...linha, metas: usuario.metas ?? {} } : linha,
        ),
      );
    } catch (error) {
      setErro(mensagemErroMetas(error, "Falha ao salvar a meta"));
    } finally {
      setOcupado(null);
    }
  }

  /**
   * Quem tem meta e como o time está HOJE, somado — o mesmo par que o
   * painel do admin mostra, com o dado que esta seção já carregou.
   */
  const comMeta = (linhas ?? []).filter((linha) => linha.metas.prospeccoesDia !== undefined);
  const usadoDia = comMeta.reduce((soma, linha) => soma + linha.prospeccao.dia.usado, 0);
  const metaDia = comMeta.reduce((soma, linha) => soma + (linha.metas.prospeccoesDia ?? 0), 0);
  const resumo =
    linhas === null
      ? undefined
      : comMeta.length === 0
        ? "nenhuma meta configurada"
        : `${comMeta.length} com meta · ${usadoDia}/${metaDia} hoje`;

  if (erro && linhas === null) {
    return (
      <PainelColapsavel id={PAINEL_METAS} titulo="Metas por integrante" resumo="restrito">
        <p className="mt-2 text-sm text-ink-muted">{erro}</p>
      </PainelColapsavel>
    );
  }

  return (
    <PainelColapsavel id={PAINEL_METAS} titulo="Metas por integrante" resumo={resumo}>
      <p className="mt-1 text-xs text-ink-muted">
        Vazio = sem meta naquela janela. Indicador de ritmo — nunca bloqueia uma busca. O
        próprio integrante vê o progresso em /hoje; a visão do time fica no painel.
      </p>

      <div className="mt-3 flex flex-col gap-3">
        {linhas === null && <SkeletonRows count={2} className="h-24 rounded border border-line" />}
        {(linhas ?? []).map((linha) => (
          <div key={linha.id} className="rounded border border-line p-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className={`text-sm ${linha.ativo ? "text-foreground" : "text-ink-muted line-through"}`}>
                {linha.nome}
              </span>
              <span className="rounded bg-surface-2 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wide text-ink-secondary">
                {linha.papel}
              </span>
            </div>
            <div className="mt-3 flex flex-col gap-1.5">
              {JANELAS_META.map(({ chave, label, campo }) => {
                const { usado } = linha.prospeccao[chave];
                return (
                  <div key={chave} className="flex items-center gap-2 text-xs text-ink-secondary">
                    <span className="w-14 shrink-0">{label}</span>
                    <span className="font-mono text-foreground">{usado}</span>
                    <span className="text-ink-muted">/</span>
                    <LimiteInput
                      valor={linha.metas[campo]}
                      disabled={ocupado === `${linha.id}:${campo}`}
                      onSalvar={(valor) => salvarMeta(linha.id, campo, valor)}
                    />
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {erro && <p className="mt-2 text-sm text-critical">{erro}</p>}
    </PainelColapsavel>
  );
}
