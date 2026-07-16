"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { Button } from "@/components/Button";
import { StatusBadge } from "@/components/StatusBadge";
import { ApiError, api } from "@/lib/api-client";
import type { Busca } from "@/lib/buscas/types";
import type { AppConfig } from "@/lib/config";
import { getSkin, getTheme } from "@/lib/demos/registry";
import { formatDateTime } from "@/lib/format";
import { VALID_TRANSITIONS, type Lead, type LeadStatus } from "@/lib/leads/types";
import { buildWhatsAppLink } from "@/lib/wa";

const TRANSITION_LABELS: Record<LeadStatus, string> = {
  novo: "Marcar como novo",
  contactado: "Marcar como contactado",
  respondeu: "Marcar como respondeu",
  fechado: "Marcar como fechado",
};

/**
 * Mensagem do WhatsApp: a do grupo (busca) mais recente do lead que tiver
 * mensagem própria; senão a global da config.
 */
function mensagemParaLead(lead: Lead, buscas: Busca[], config: AppConfig): string {
  const porId = new Map(buscas.map((busca) => [busca.id, busca]));
  for (const id of [...(lead.buscaId ?? [])].reverse()) {
    const propria = porId.get(id)?.mensagemPadrao;
    if (propria) return propria;
  }
  return config.mensagemPadrao;
}

export function LeadDetailClient({ id }: { id: string }) {
  const [lead, setLead] = useState<Lead | null>(null);
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [buscas, setBuscas] = useState<Busca[]>([]);
  const [notFound, setNotFound] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [enriching, setEnriching] = useState(false);
  const [enrichErro, setEnrichErro] = useState<string | null>(null);
  const [changingTo, setChangingTo] = useState<LeadStatus | null>(null);
  const [descartando, setDescartando] = useState(false);
  const [demoErro, setDemoErro] = useState<string | null>(null);
  const [demoAviso, setDemoAviso] = useState<string | null>(null);

  useEffect(() => {
    let ignore = false;
    Promise.all([api.getLead(id), api.getConfig(), api.listBuscas()])
      .then(([{ lead: leadData }, { config: configData }, { buscas: buscasData }]) => {
        if (ignore) return;
        setLead(leadData);
        setConfig(configData);
        setBuscas(buscasData);
        setNotFound(false);
        setErro(null);
      })
      .catch((error) => {
        if (ignore) return;
        if (error instanceof ApiError && error.code === "not_found") {
          setNotFound(true);
        } else {
          setErro(error instanceof ApiError ? error.message : "Falha ao carregar o lead.");
        }
      })
      .finally(() => {
        if (!ignore) setLoading(false);
      });
    return () => {
      ignore = true;
    };
  }, [id]);

  async function handleEnrich() {
    setEnriching(true);
    setEnrichErro(null);
    try {
      const { lead: updated } = await api.enrichLead(id);
      setLead(updated);
    } catch (error) {
      if (error instanceof ApiError && error.code === "quota_exceeded") {
        setEnrichErro(
          `Teto mensal atingido para ${error.extra.sku} (${error.extra.used}/${error.extra.cap} em ${error.extra.period}).`,
        );
      } else if (error instanceof ApiError && error.code === "places_error") {
        setEnrichErro(`Erro do Google: ${error.extra.detail ?? error.message}`);
      } else {
        setEnrichErro(error instanceof ApiError ? error.message : "Falha ao enriquecer.");
      }
    } finally {
      setEnriching(false);
    }
  }

  async function handleStatus(para: LeadStatus) {
    setChangingTo(para);
    setErro(null);
    try {
      const { lead: updated } = await api.patchLead(id, { status: para });
      setLead(updated);
    } catch (error) {
      setErro(error instanceof ApiError ? error.message : "Falha ao trocar o status.");
    } finally {
      setChangingTo(null);
    }
  }

  async function handleCopyDemoLink() {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/demo/${id}`);
      setDemoAviso("Link copiado!");
      setDemoErro(null);
    } catch {
      setDemoErro("Não deu pra copiar — copie da barra de endereço da demo.");
    }
  }

  async function handleDescarte() {
    if (!lead) return;
    setDescartando(true);
    setErro(null);
    try {
      const { lead: updated } = await api.patchLead(id, { descartado: !lead.descartado });
      setLead(updated);
    } catch (error) {
      setErro(error instanceof ApiError ? error.message : "Falha ao descartar.");
    } finally {
      setDescartando(false);
    }
  }

  if (loading) {
    return <p className="text-sm text-ink-muted">Carregando…</p>;
  }

  if (notFound) {
    return (
      <div className="flex flex-col gap-3">
        <p className="text-sm text-ink-muted">Lead não encontrado.</p>
        <Link href="/leads" className="text-sm text-accent">
          Voltar para leads
        </Link>
      </div>
    );
  }

  if (erro && !lead) {
    return <p className="text-sm text-critical">{erro}</p>;
  }
  if (!lead) {
    return <p className="text-sm text-critical">Falha ao carregar o lead.</p>;
  }

  const detalhes = lead.detalhes;
  // Telefone da busca qualificada já sustenta o botão — sem enriquecer.
  const telefoneIntl = detalhes?.telefoneIntl ?? lead.telefoneIntl;
  // Só renderiza com lead carregado (client), então window existe.
  const demoUrl = `${window.location.origin}/demo/${lead.placeId}`;
  const waLink =
    telefoneIntl && config
      ? buildWhatsAppLink(
          mensagemParaLead(lead, buscas, config),
          lead.nome,
          telefoneIntl,
          demoUrl,
        )
      : null;
  const skinAtual = getSkin(lead.demo?.skinId);
  // Derivado no servidor (asLead): true = site próprio; false = sem site OU
  // só rede social/agregador; undefined = desconhecido.
  const siteEhProprio = lead.siteProprio;

  return (
    <div className="flex flex-col gap-5">
      <div>
        <button
          type="button"
          onClick={() => window.history.back()}
          className="text-xs text-ink-muted hover:text-foreground"
        >
          ← Leads
        </button>
        <div className="mt-2 flex items-start justify-between gap-2">
          <h1 className="font-display text-xl font-bold text-foreground">{lead.nome}</h1>
          <StatusBadge status={lead.status} />
        </div>
        {lead.endereco && <p className="mt-1 text-sm text-ink-secondary">{lead.endereco}</p>}
        {lead.descartado && (
          <p className="mt-2 inline-block rounded border border-critical/40 bg-critical/10 px-2 py-1 text-xs text-critical">
            Lead descartado — continua na base e pode ser restaurado.
          </p>
        )}
      </div>

      <section className="rounded-lg border border-line bg-surface p-4">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
          Detalhes
        </h2>
        {lead.enriquecido && detalhes ? (
          <dl className="mt-3 flex flex-col gap-2 text-sm">
            <Row label="Telefone" value={detalhes.telefone ?? "—"} />
            <Row
              label="Site"
              value={
                detalhes.site
                  ? siteEhProprio
                    ? detalhes.site
                    : `${detalhes.site} (rede social — sem site próprio)`
                  : "sem site (lead quente)"
              }
              highlight={!detalhes.site || siteEhProprio === false}
            />
            <Row
              label="Avaliação"
              value={
                detalhes.rating !== undefined
                  ? `${detalhes.rating} (${detalhes.totalAvaliacoes ?? 0} avaliações)`
                  : "—"
              }
            />
            <Row label="Enriquecido em" value={formatDateTime(detalhes.enriquecidoEm)} />
          </dl>
        ) : (
          <div className="mt-3">
            {(lead.telefone !== undefined || lead.temSite !== undefined) && (
              <dl className="mb-3 flex flex-col gap-2 text-sm">
                {lead.telefone !== undefined && (
                  <Row label="Telefone (da busca)" value={lead.telefone} />
                )}
                {lead.temSite !== undefined && (
                  <Row
                    label="Site (da busca)"
                    value={
                      siteEhProprio
                        ? (lead.siteUrl ?? "sim")
                        : lead.siteUrl
                          ? `${lead.siteUrl} (rede social — sem site próprio)`
                          : "sem site (lead quente)"
                    }
                    highlight={siteEhProprio === false}
                  />
                )}
              </dl>
            )}
            <p className="text-sm text-ink-muted">
              Ainda não enriquecido{lead.temTelefone ? " (rating e mais no enriquecimento)" : ""}.
            </p>
            <Button onClick={handleEnrich} loading={enriching} className="mt-3">
              Enriquecer
            </Button>
            {enrichErro && <p className="mt-2 text-sm text-critical">{enrichErro}</p>}
          </div>
        )}
      </section>

      {waLink && (
        <a
          href={waLink}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded bg-good px-3 py-2 text-center text-sm font-semibold text-good-ink hover:bg-good/90"
        >
          Chamar no WhatsApp
        </a>
      )}

      <section className="rounded-lg border border-line bg-surface p-4">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-ink-muted">Demo</h2>
          {lead.demo && (
            <a
              href={demoUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-accent hover:underline"
            >
              Abrir demo ↗
            </a>
          )}
        </div>
        {lead.demo ? (
          <div className="mt-2 flex flex-col gap-3">
            <p className="text-xs text-ink-muted">
              Publicada em <code className="font-mono">/demo/{lead.placeId}</code> — use{" "}
              <code className="font-mono">{"{demo}"}</code> na mensagem do WhatsApp para
              enviar o link.
            </p>
            <dl className="flex flex-col gap-2 text-sm">
              <Row label="Skin" value={skinAtual ? `${skinAtual.nome} (${skinAtual.nicho})` : lead.demo.skinId} />
              <Row
                label="Tema"
                value={skinAtual ? getTheme(skinAtual, lead.demo.themeId).nome : lead.demo.themeId}
              />
              <Row label="Atualizada em" value={formatDateTime(lead.demo.atualizadoEm)} />
            </dl>
            <div className="flex flex-wrap items-center gap-2">
              <Link
                href={`/leads/${lead.placeId}/demo/editar`}
                className="rounded bg-accent px-3 py-2 text-sm font-medium text-accent-ink hover:bg-accent/90"
              >
                Editar demo
              </Link>
              <Button variant="secondary" onClick={handleCopyDemoLink}>
                Copiar link
              </Button>
              {demoAviso && <span className="text-xs text-good">{demoAviso}</span>}
            </div>
          </div>
        ) : (
          <div className="mt-2 flex flex-col gap-3">
            <p className="text-xs text-ink-muted">
              Nenhuma demo criada — o link público <code className="font-mono">/demo/{lead.placeId}</code>{" "}
              responde 404 até você montar e salvar uma no editor.
            </p>
            <div>
              <Link
                href={`/leads/${lead.placeId}/demo/editar`}
                className="inline-block rounded bg-accent px-3 py-2 text-sm font-medium text-accent-ink hover:bg-accent/90"
              >
                Criar demo
              </Link>
            </div>
          </div>
        )}
        {demoErro && <p className="mt-2 text-sm text-critical">{demoErro}</p>}
      </section>

      <section className="rounded-lg border border-line bg-surface p-4">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-ink-muted">Status</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          {VALID_TRANSITIONS[lead.status].map((para) => (
            <Button
              key={para}
              variant="secondary"
              onClick={() => handleStatus(para)}
              loading={changingTo === para}
            >
              {TRANSITION_LABELS[para]}
            </Button>
          ))}
          {VALID_TRANSITIONS[lead.status].length === 0 && (
            <p className="text-sm text-ink-muted">Status final.</p>
          )}
        </div>
        {lead.contato && (
          <dl className="mt-4 flex flex-col gap-1 text-xs text-ink-muted">
            {lead.contato.primeiroContatoEm && (
              <Row label="Primeiro contato" value={formatDateTime(lead.contato.primeiroContatoEm)} compact />
            )}
            {lead.contato.respondeuEm && (
              <Row label="Respondeu" value={formatDateTime(lead.contato.respondeuEm)} compact />
            )}
            {lead.contato.fechadoEm && (
              <Row label="Fechado" value={formatDateTime(lead.contato.fechadoEm)} compact />
            )}
          </dl>
        )}
      </section>

      <Button
        variant={lead.descartado ? "secondary" : "ghost"}
        onClick={handleDescarte}
        loading={descartando}
      >
        {lead.descartado ? "Restaurar lead" : "Descartar lead"}
      </Button>

      {erro && <p className="text-sm text-critical">{erro}</p>}
    </div>
  );
}

function Row({
  label,
  value,
  highlight,
  compact,
}: {
  label: string;
  value: string;
  highlight?: boolean;
  compact?: boolean;
}) {
  return (
    <div className={`flex items-center justify-between gap-2 ${compact ? "" : "text-sm"}`}>
      <dt className="text-ink-muted">{label}</dt>
      <dd className={highlight ? "text-right font-medium text-good" : "text-right text-foreground"}>
        {value}
      </dd>
    </div>
  );
}
