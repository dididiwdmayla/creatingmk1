"use client";

import { useEffect, useState } from "react";

import { SkeletonRows } from "@/components/Skeleton";
import { UsageMeter } from "@/components/UsageMeter";
import { PainelColapsavel } from "@/components/config/PainelColapsavel";
import { LimiteInput } from "@/components/config/comum";
import {
  ApiError,
  api,
  type CotasUsuariosResponse,
  type UsageResponse,
} from "@/lib/api-client";
import type { Sku, UsoUsuario } from "@/lib/costs";
import { SKU_LABELS } from "@/lib/sku-labels";
import type { LimitesUsuario } from "@/lib/usuarios/types";

/** Chave da persistência deste painel — ver `PainelColapsavel`. */
const PAINEL_COTAS = "cotas-usuarios";

/** SKUs relevantes à cota individual — resumo compacto no topo da seção de cotas. */
const SKUS_COTA_INDIVIDUAL: Sku[] = [
  "textSearch",
  "textSearchEnterprise",
  "detailsEnterprise",
  "detailsProHours",
  "aiGeneration",
  "aiTraducao",
];

type CampoLimite = keyof LimitesUsuario;

const JANELAS: Array<{ chave: "dia" | "semana" | "mes"; label: string; sufixo: "Dia" | "Semana" | "Mes" }> = [
  { chave: "dia", label: "Hoje", sufixo: "Dia" },
  { chave: "semana", label: "Semana", sufixo: "Semana" },
  { chave: "mes", label: "Mês", sufixo: "Mes" },
];

/** Fetcher puro (não mexe em estado) — reaproveitado pela carga inicial e por "zerar dia". */
async function fetchCotasData(): Promise<{ cotas: CotasUsuariosResponse; usage: UsageResponse }> {
  const [cotas, usage] = await Promise.all([api.getCotasUsuarios(), api.getUsage()]);
  return { cotas, usage };
}

/** Mensagem de erro com o `code` da API — sem isso, um 500 inesperado vira só "falha genérica". */
function mensagemErroCotas(error: unknown, fallback: string): string {
  return error instanceof ApiError ? `${fallback} (${error.code}): ${error.message}` : fallback;
}

/**
 * Cotas individuais (admin): tabela usado/limite × dia/semana/mês, por
 * usuário, para os três tipos (buscas/enriquecimentos/gerações de IA) —
 * reserveQuota já garante o bloqueio no servidor; esta seção só edita os
 * limites e mostra o uso. Edição inline com efeito imediato (cada campo
 * salva sozinho no blur, sem botão "Salvar" à parte — a config é lida
 * fresca a cada request, então vale na ação seguinte). "Zerar dia" refaz a
 * leitura inteira: mais simples e correto que tentar ajustar local a soma
 * de semana/mês, que é agregação pura sobre os dias.
 *
 * `geracoesIA` é UM contador para três ações distintas — geração de texto
 * da demo (SKU `aiGeneration`), tradução de frase por skin (SKU
 * `aiTraducao`) e análise interna do grupo (SKU `aiGeneration`) — cada uma
 * disputando o mesmo limite individual, embora consumam SKUs (tetos
 * globais) diferentes. Precificação regional e tradução de nicho também
 * usam `aiGeneration`, mas ficam de fora desta cota individual: são
 * geradas uma vez e cacheadas para o time inteiro, não uma ação pessoal
 * repetida — cobrar do primeiro a abrir uma região nova seria injusto.
 */
export function CotasUsuariosSection() {
  const [linhas, setLinhas] = useState<CotasUsuariosResponse["usuarios"] | null>(null);
  const [usoGlobal, setUsoGlobal] = useState<UsageResponse | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState<string | null>(null);

  useEffect(() => {
    let ignore = false;
    fetchCotasData()
      .then(({ cotas, usage }) => {
        if (ignore) return;
        setLinhas(cotas.usuarios);
        setUsoGlobal(usage);
        setErro(null);
      })
      .catch((error) => {
        if (ignore) return;
        setErro(
          error instanceof ApiError && error.status === 403
            ? "Cotas são restritas ao admin."
            : mensagemErroCotas(error, "Falha ao carregar as cotas"),
        );
      });
    return () => {
      ignore = true;
    };
  }, []);

  async function salvarLimite(id: string, campo: CampoLimite, valor: number | null) {
    const chave = `${id}:${campo}`;
    setOcupado(chave);
    setErro(null);
    try {
      const { usuario } = await api.patchUsuario(id, { limites: { [campo]: valor } });
      setLinhas((atual) =>
        (atual ?? []).map((linha) =>
          linha.id === id ? { ...linha, limites: usuario.limites ?? {} } : linha,
        ),
      );
    } catch (error) {
      setErro(mensagemErroCotas(error, "Falha ao salvar o limite"));
    } finally {
      setOcupado(null);
    }
  }

  async function zerarDia(id: string, nome: string) {
    setOcupado(`${id}:zerar`);
    setErro(null);
    setAviso(null);
    try {
      await api.zerarCotaDiaUsuario(id);
      const { cotas, usage } = await fetchCotasData();
      setLinhas(cotas.usuarios);
      setUsoGlobal(usage);
      setAviso(`Dia de "${nome}" zerado.`);
    } catch (error) {
      setErro(mensagemErroCotas(error, "Falha ao zerar o dia"));
    } finally {
      setOcupado(null);
    }
  }

  /**
   * Quantos usuários, e quantos já bateram alguma cota do DIA — o que
   * decide se o admin precisa abrir (alguém travado não consegue buscar).
   * Sai das linhas que a seção já carregou.
   */
  const noLimite = (linhas ?? []).filter((linha) =>
    [linha.buscas, linha.enriquecimentos, linha.geracoesIA].some(
      ({ dia }) => dia.limite !== undefined && dia.usado >= dia.limite,
    ),
  ).length;
  const resumo =
    linhas === null
      ? undefined
      : `${linhas.length} usuários${noLimite > 0 ? ` · ${noLimite} no limite hoje` : ""}`;

  if (erro && linhas === null) {
    return (
      <PainelColapsavel id={PAINEL_COTAS} titulo="Cotas por usuário" resumo="restrito">
        <p className="mt-2 text-sm text-ink-muted">{erro}</p>
      </PainelColapsavel>
    );
  }

  return (
    <PainelColapsavel id={PAINEL_COTAS} titulo="Cotas por usuário" resumo={resumo}>
      <p className="mt-1 text-xs text-ink-muted">
        Vazio = sem limite naquela janela. Admin nunca é bloqueado — os limites dele aqui são só
        informativos.
      </p>

      <div className="mt-3 flex flex-col gap-3 rounded border border-line p-3">
        <p className="text-[11px] uppercase tracking-wide text-ink-muted">
          Teto global do mês (bloqueia membros; admin passa direto)
        </p>
        {usoGlobal ? (
          SKUS_COTA_INDIVIDUAL.map((sku) => (
            <UsageMeter
              key={sku}
              label={SKU_LABELS[sku]}
              used={usoGlobal.usage[sku]}
              cap={usoGlobal.caps[sku]}
              freeQuota={usoGlobal.cotaGratis[sku]}
            />
          ))
        ) : (
          <SkeletonRows count={SKUS_COTA_INDIVIDUAL.length} className="h-6" />
        )}
      </div>

      <div className="mt-3 flex flex-col gap-3">
        {linhas === null && <SkeletonRows count={2} className="h-20 rounded border border-line" />}
        {(linhas ?? []).map((linha) => (
          <div key={linha.id} className="rounded border border-line p-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className={`text-sm ${linha.ativo ? "text-foreground" : "text-ink-muted line-through"}`}>
                {linha.nome}
              </span>
              <span className="rounded bg-surface-2 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wide text-ink-secondary">
                {linha.papel}
              </span>
              <button
                type="button"
                disabled={ocupado === `${linha.id}:zerar`}
                onClick={() => zerarDia(linha.id, linha.nome)}
                className="ml-auto text-xs text-accent hover:underline disabled:opacity-50"
              >
                Zerar dia
              </button>
            </div>
            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              <LinhaCota
                label="Buscas"
                uso={linha.buscas}
                prefixo="buscas"
                userId={linha.id}
                ocupado={ocupado}
                onSalvar={salvarLimite}
              />
              <LinhaCota
                label="Enriquecimentos"
                uso={linha.enriquecimentos}
                prefixo="enriquecimentos"
                userId={linha.id}
                ocupado={ocupado}
                onSalvar={salvarLimite}
              />
              <LinhaCota
                label="Gerações de IA"
                uso={linha.geracoesIA}
                prefixo="geracoesIA"
                userId={linha.id}
                ocupado={ocupado}
                onSalvar={salvarLimite}
              />
            </div>
          </div>
        ))}
      </div>

      {erro && <p className="mt-2 text-sm text-critical">{erro}</p>}
      {aviso && <p className="mt-2 text-sm text-good">{aviso}</p>}
    </PainelColapsavel>
  );
}

function LinhaCota({
  label,
  uso,
  prefixo,
  userId,
  ocupado,
  onSalvar,
}: {
  label: string;
  uso: UsoUsuario;
  prefixo: "buscas" | "enriquecimentos" | "geracoesIA";
  userId: string;
  ocupado: string | null;
  onSalvar: (id: string, campo: CampoLimite, valor: number | null) => void;
}) {
  return (
    <div>
      <p className="text-[11px] uppercase tracking-wide text-ink-muted">{label}</p>
      <div className="mt-1.5 flex flex-col gap-1.5">
        {JANELAS.map(({ chave, label: janelaLabel, sufixo }) => {
          const campo = `${prefixo}${sufixo}` as CampoLimite;
          const { usado, limite } = uso[chave];
          return (
            <div key={chave} className="flex items-center gap-2 text-xs text-ink-secondary">
              <span className="w-14 shrink-0">{janelaLabel}</span>
              <span className="font-mono text-foreground">{usado}</span>
              <span className="text-ink-muted">/</span>
              <LimiteInput
                valor={limite}
                disabled={ocupado === `${userId}:${campo}`}
                onSalvar={(valor) => onSalvar(userId, campo, valor)}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
