"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { Button } from "@/components/Button";
import { ApiError, api } from "@/lib/api-client";
import { demoUrlComToken, envioVigente } from "@/lib/demos/envio";
import { getSkin } from "@/lib/demos/registry";
import { formatDateTime, formatTempoRelativo } from "@/lib/format";
import { ultimaAberturaNaoInterna } from "@/lib/leads/hoje";
import type { Lead } from "@/lib/leads/types";

/**
 * Todas as demos ativas (leads com `demo` salva): skin, datas de
 * criação/edição, link público copiável e atalhos para editar/excluir.
 * Reaproveita GET /api/leads (sem filtros) e filtra client-side — mesma
 * escala de "centenas de leads" do resto do app.
 */
export default function DemosPage() {
  const [leads, setLeads] = useState<Lead[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [copiado, setCopiado] = useState<string | null>(null);
  const [confirmaExcluir, setConfirmaExcluir] = useState<string | null>(null);
  const [excluindo, setExcluindo] = useState<string | null>(null);
  // Instante fixo da carga, pro selo "aberta há X" (Date.now() no render é
  // impuro pro React Compiler — mesmo padrão de /hoje).
  const [agora, setAgora] = useState(0);

  useEffect(() => {
    let ignore = false;
    api
      .listLeads({})
      .then(({ leads: data }) => {
        if (!ignore) {
          setLeads(data);
          setAgora(Date.now());
        }
      })
      .catch((error) => {
        if (!ignore) {
          setErro(error instanceof ApiError ? error.message : "Falha ao carregar as demos.");
        }
      });
    return () => {
      ignore = true;
    };
  }, []);

  async function copiarLink(lead: Lead) {
    try {
      // Canal "link" — independente do token que possa estar numa mensagem
      // de WhatsApp já montada pra este mesmo lead (ver EnvioDemo.canal).
      const token = envioVigente(lead.demo, "link")?.token;
      const url = demoUrlComToken(window.location.origin, lead.placeId, token);
      await navigator.clipboard.writeText(url);
      setCopiado(lead.placeId);
      setTimeout(() => setCopiado((atual) => (atual === lead.placeId ? null : atual)), 2000);
    } catch {
      setErro("Não deu pra copiar — copie da barra de endereço da demo.");
    }
  }

  async function excluir(id: string) {
    if (confirmaExcluir !== id) {
      setConfirmaExcluir(id);
      return;
    }
    setExcluindo(id);
    try {
      await api.deleteLeadDemo(id);
      setLeads((atual) => atual?.filter((lead) => lead.placeId !== id) ?? atual);
    } catch (error) {
      setErro(error instanceof ApiError ? error.message : "Falha ao excluir a demo.");
    } finally {
      setExcluindo(null);
      setConfirmaExcluir(null);
    }
  }

  if (erro && leads === null) {
    return <p className="text-sm text-critical">{erro}</p>;
  }

  if (leads === null) {
    return <p className="text-sm text-ink-muted">Carregando…</p>;
  }

  const demos = leads
    .filter((lead): lead is Lead & { demo: NonNullable<Lead["demo"]> } => Boolean(lead.demo))
    .sort((a, b) => b.demo.atualizadoEm.localeCompare(a.demo.atualizadoEm));

  if (demos.length === 0) {
    return (
      <p className="text-sm text-ink-muted">
        Nenhuma demo criada ainda. Abra a ficha de um lead e use{" "}
        <span className="text-foreground">Criar demo</span>.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs text-ink-muted">
        {demos.length} demo{demos.length === 1 ? "" : "s"} ativa{demos.length === 1 ? "" : "s"}
      </p>
      {erro && <p className="text-sm text-critical">{erro}</p>}
      <ul className="flex flex-col gap-2">
        {demos.map((lead) => {
          const skin = getSkin(lead.demo.skinId);
          const ultimaAbertura = ultimaAberturaNaoInterna(lead);
          return (
            <li
              key={lead.placeId}
              className="card-lift rounded-lg border border-line bg-surface p-3"
            >
              <div className="flex items-start justify-between gap-2">
                <Link href={`/leads/${lead.placeId}`} className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground">{lead.nome}</p>
                  <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                    <p className="truncate text-xs text-ink-secondary">
                      {skin?.nome ?? lead.demo.skinId}
                    </p>
                    {ultimaAbertura ? (
                      <span
                        title={formatDateTime(ultimaAbertura)}
                        className="shrink-0 rounded-full bg-good/15 px-1.5 py-0.5 text-[10px] font-semibold text-good"
                      >
                        aberta {agora > 0 ? formatTempoRelativo(ultimaAbertura, agora) : ""}
                      </span>
                    ) : (
                      <span className="shrink-0 rounded-full bg-surface-2 px-1.5 py-0.5 text-[10px] font-semibold text-ink-muted">
                        não aberta
                      </span>
                    )}
                  </div>
                </Link>
                <div className="shrink-0 text-right text-[11px] text-ink-muted">
                  <p>Criada {formatDateTime(lead.demo.criadoEm)}</p>
                  <p>Editada {formatDateTime(lead.demo.atualizadoEm)}</p>
                </div>
              </div>

              <div className="mt-2.5 flex flex-wrap items-center gap-2">
                <a
                  href={`/demo/${lead.placeId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-accent hover:underline"
                >
                  Abrir demo ↗
                </a>
                <button
                  type="button"
                  onClick={() => copiarLink(lead)}
                  className="text-xs text-ink-muted hover:text-foreground"
                >
                  {copiado === lead.placeId ? "Copiado!" : "Copiar link"}
                </button>
                <Link
                  href={`/leads/${lead.placeId}/demo/editar`}
                  className="text-xs text-ink-muted hover:text-foreground"
                >
                  Editar
                </Link>
                <span className="ml-auto" />
                {confirmaExcluir === lead.placeId && (
                  <span className="text-[11px] text-critical">Apaga registro e imagens.</span>
                )}
                <Button
                  variant="danger"
                  onClick={() => excluir(lead.placeId)}
                  loading={excluindo === lead.placeId}
                  className="!px-2 !py-1 text-xs"
                >
                  {confirmaExcluir === lead.placeId ? "Confirmar exclusão" : "Excluir"}
                </Button>
                {confirmaExcluir === lead.placeId && excluindo !== lead.placeId && (
                  <button
                    type="button"
                    onClick={() => setConfirmaExcluir(null)}
                    className="text-xs text-ink-muted hover:text-foreground"
                  >
                    Cancelar
                  </button>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
