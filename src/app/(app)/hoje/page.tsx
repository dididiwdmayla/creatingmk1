"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { StatusBadge } from "@/components/StatusBadge";
import { ApiError, api, type HojeResponse } from "@/lib/api-client";
import { formatDateTime, formatInt } from "@/lib/format";
import { calculaScore } from "@/lib/leads/score";
import type { Lead } from "@/lib/leads/types";
import { buildWhatsAppLink } from "@/lib/wa";

/**
 * Fila do dia — a home pós-login. Três seções vindas de GET /api/hoje:
 * novos desde a última visita (por usuário, ordenados por score),
 * follow-ups (contactado sem resposta há N+ dias) e demos paradas
 * (demo criada, lead ainda "novo"). Cada item com ação direta.
 */

const DIA_MS = 24 * 60 * 60 * 1000;

type BuscaResumo = HojeResponse["buscas"][number];

/** Busca de ORIGEM do lead = a primeira em que ele apareceu. */
function buscaDeOrigem(lead: Lead, porId: Map<string, BuscaResumo>): BuscaResumo | undefined {
  const primeira = lead.buscaId?.[0];
  return primeira ? porId.get(primeira) : undefined;
}

/** Mesma regra da ficha: mensagem do grupo mais recente com própria; senão a global. */
function mensagemParaLead(
  lead: Lead,
  porId: Map<string, BuscaResumo>,
  global: string,
): string {
  for (const id of [...(lead.buscaId ?? [])].reverse()) {
    const propria = porId.get(id)?.mensagemPadrao;
    if (propria) return propria;
  }
  return global;
}

function diasSemResposta(lead: Lead, agora: number): number {
  const em = lead.contato?.primeiroContatoEm;
  if (!em) return 0;
  return Math.floor((agora - new Date(em).getTime()) / DIA_MS);
}

export default function HojePage() {
  const [dados, setDados] = useState<HojeResponse | null>(null);
  // Instante da carga, para o "Xd sem resposta" (Date.now() no render é
  // impuro para o React Compiler).
  const [agora, setAgora] = useState(0);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    let ignore = false;
    api
      .hoje()
      .then((data) => {
        if (ignore) return;
        setDados(data);
        setAgora(Date.now());
      })
      .catch((error) => {
        if (!ignore) {
          setErro(
            error instanceof ApiError ? error.message : "Falha ao carregar a fila do dia.",
          );
        }
      });
    return () => {
      ignore = true;
    };
  }, []);

  if (erro) {
    return <p className="text-sm text-critical">{erro}</p>;
  }
  if (!dados) {
    return <p className="text-sm text-ink-muted">Montando a fila do dia…</p>;
  }

  const porId = new Map(dados.buscas.map((busca) => [busca.id, busca]));
  const vazia =
    dados.novos.length === 0 &&
    dados.followUps.length === 0 &&
    dados.demosParadas.length === 0;

  return (
    <div className="flex flex-col gap-6">
      <section>
        <h1 className="font-display text-2xl font-bold text-foreground">Hoje</h1>
        <p className="mt-1 text-sm text-ink-secondary">
          {formatInt(dados.novos.length)} novo(s) · {formatInt(dados.followUps.length)}{" "}
          follow-up(s) · {formatInt(dados.demosParadas.length)} demo(s) parada(s)
        </p>
        {dados.novosDesde && (
          <p className="mt-0.5 text-xs text-ink-muted">
            novos desde a sua última visita ({formatDateTime(dados.novosDesde)})
          </p>
        )}
      </section>

      {vazia && (
        <p className="rounded-lg border border-line bg-surface p-4 text-sm text-ink-muted">
          Fila limpa — nenhum lead novo, follow-up pendente ou demo parada. Faça uma{" "}
          <Link href="/leads" className="text-accent">
            nova busca
          </Link>{" "}
          ou confira o{" "}
          <Link href="/" className="text-accent">
            painel
          </Link>
          .
        </p>
      )}

      {dados.novos.length > 0 && (
        <Secao titulo={`Leads novos (${dados.novos.length})`}>
          {dados.novos.map((lead) => (
            <ItemHoje
              key={lead.placeId}
              lead={lead}
              porId={porId}
              mensagemGlobal={dados.mensagemPadrao}
              extra={
                <span
                  title="Score de priorização"
                  className="rounded-full bg-surface-2 px-1.5 py-0.5 font-mono text-[10px] font-semibold tabular-nums text-ink-secondary"
                >
                  {calculaScore(lead) > 0 ? `+${calculaScore(lead)}` : calculaScore(lead)}
                </span>
              }
            />
          ))}
        </Secao>
      )}

      {dados.followUps.length > 0 && (
        <Secao
          titulo={`Follow-ups (${dados.followUps.length})`}
          subtitulo={`contactados sem resposta há mais de ${dados.followUpDias} dia(s), o mais antigo primeiro`}
        >
          {dados.followUps.map((lead) => (
            <ItemHoje
              key={lead.placeId}
              lead={lead}
              porId={porId}
              mensagemGlobal={dados.mensagemPadrao}
              extra={
                <span className="rounded-full bg-warning/15 px-1.5 py-0.5 text-[10px] font-semibold text-warning">
                  {diasSemResposta(lead, agora)}d sem resposta
                </span>
              }
            />
          ))}
        </Secao>
      )}

      {dados.demosParadas.length > 0 && (
        <Secao
          titulo={`Demos paradas (${dados.demosParadas.length})`}
          subtitulo="demo criada, lead ainda sem contato — envie o link"
        >
          {dados.demosParadas.map((lead) => (
            <ItemHoje
              key={lead.placeId}
              lead={lead}
              porId={porId}
              mensagemGlobal={dados.mensagemPadrao}
              extra={
                lead.demo && (
                  <span className="rounded-full bg-accent/15 px-1.5 py-0.5 text-[10px] font-semibold text-accent">
                    demo de {formatDateTime(lead.demo.criadoEm)}
                  </span>
                )
              }
            />
          ))}
        </Secao>
      )}
    </div>
  );
}

function Secao({
  titulo,
  subtitulo,
  children,
}: {
  titulo: string;
  subtitulo?: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h2 className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
        {titulo}
      </h2>
      {subtitulo && <p className="mt-0.5 text-xs text-ink-muted">{subtitulo}</p>}
      <div className="mt-2 flex flex-col gap-2">{children}</div>
    </section>
  );
}

function ItemHoje({
  lead,
  porId,
  mensagemGlobal,
  extra,
}: {
  lead: Lead;
  porId: Map<string, BuscaResumo>;
  mensagemGlobal: string;
  extra?: React.ReactNode;
}) {
  const origem = buscaDeOrigem(lead, porId);
  const telefoneIntl = lead.detalhes?.telefoneIntl ?? lead.telefoneIntl;
  const demoUrl =
    lead.demo && typeof window !== "undefined"
      ? `${window.location.origin}/demo/${lead.placeId}`
      : undefined;
  const waHref = telefoneIntl
    ? buildWhatsAppLink(mensagemParaLead(lead, porId, mensagemGlobal), lead.nome, telefoneIntl, demoUrl)
    : undefined;

  return (
    <div className="card-lift rounded-lg border border-line bg-surface p-3">
      <div className="flex items-start justify-between gap-2">
        <Link href={`/leads/${lead.placeId}`} className="min-w-0 flex-1 hover:opacity-80">
          <p className="truncate text-sm font-medium text-foreground">{lead.nome}</p>
          {lead.endereco && (
            <p className="truncate text-xs text-ink-muted">{lead.endereco}</p>
          )}
        </Link>
        <div className="flex shrink-0 items-center gap-2">
          {extra}
          <StatusBadge status={lead.status} />
        </div>
      </div>

      <div className="mt-2 flex items-center justify-between gap-2">
        {origem ? (
          <span className="flex min-w-0 items-center gap-1.5 text-xs text-ink-secondary">
            <span
              aria-hidden
              className="h-2.5 w-2.5 shrink-0 rounded-full"
              style={{ backgroundColor: origem.cor }}
            />
            <span className="truncate">{origem.nome}</span>
          </span>
        ) : (
          <span />
        )}
        <span className="flex shrink-0 items-center gap-3 text-xs">
          {waHref && (
            <a
              href={waHref}
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-good hover:underline"
            >
              WhatsApp
            </a>
          )}
          {lead.demo && (
            <a
              href={`/demo/${lead.placeId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-accent hover:underline"
            >
              Demo
            </a>
          )}
          <Link href={`/leads/${lead.placeId}`} className="text-ink-muted hover:text-foreground">
            Ficha
          </Link>
        </span>
      </div>
    </div>
  );
}
