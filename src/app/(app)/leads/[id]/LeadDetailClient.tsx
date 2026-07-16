"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { Button } from "@/components/Button";
import { StatusBadge } from "@/components/StatusBadge";
import { ApiError, api } from "@/lib/api-client";
import type { Busca } from "@/lib/buscas/types";
import type { AppConfig } from "@/lib/config";
import { montarDemoData } from "@/lib/demos/montar";
import { DEFAULT_SKIN, SKINS, getSkin } from "@/lib/demos/registry";
import type { DemoDataPatch } from "@/lib/demos/types";
import { formatDateTime } from "@/lib/format";
import { VALID_TRANSITIONS, type Lead, type LeadStatus } from "@/lib/leads/types";
import { buildWhatsAppLink } from "@/lib/wa";

const TRANSITION_LABELS: Record<LeadStatus, string> = {
  novo: "Marcar como novo",
  contactado: "Marcar como contactado",
  respondeu: "Marcar como respondeu",
  fechado: "Marcar como fechado",
};

/** Campos de DemoData editáveis direto na ficha (pré-preenchidos). */
const DEMO_CAMPOS = [
  { chave: "nome", rotulo: "Nome do negócio" },
  { chave: "slogan", rotulo: "Slogan" },
  { chave: "endereco", rotulo: "Endereço" },
  { chave: "telefone", rotulo: "Telefone" },
  { chave: "whatsapp", rotulo: "WhatsApp" },
  { chave: "instagram", rotulo: "Instagram" },
  { chave: "horarios", rotulo: "Horários" },
] as const;

type DemoCampo = (typeof DEMO_CAMPOS)[number]["chave"];
type DemoCampos = Record<DemoCampo, string>;

/**
 * Estado inicial do form de demo: skin/tema salvos (ou defaults) e campos
 * pré-preenchidos com o DemoData efetivo (exemplo ← lead ← edições salvas).
 */
function demoFormFromLead(lead: Lead, skinId?: string): {
  skinId: string;
  themeId: string;
  campos: DemoCampos;
} {
  const querida = skinId ?? lead.demo?.skinId;
  const skin = getSkin(querida) ?? DEFAULT_SKIN;
  // Edições salvas só valem para a skin em que foram feitas.
  const salvas = lead.demo?.skinId === skin.id ? lead.demo.dados : undefined;
  const data = montarDemoData(skin.demoDataExemplo, lead, salvas);
  const themeSalvo = lead.demo?.skinId === skin.id ? lead.demo.themeId : undefined;
  return {
    skinId: skin.id,
    themeId: skin.themePresets.some((t) => t.id === themeSalvo)
      ? (themeSalvo as string)
      : skin.themeDefault.id,
    campos: Object.fromEntries(
      DEMO_CAMPOS.map(({ chave }) => [chave, data[chave] ?? ""]),
    ) as DemoCampos,
  };
}

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
  const [demoSkinId, setDemoSkinId] = useState(DEFAULT_SKIN.id);
  const [demoThemeId, setDemoThemeId] = useState(DEFAULT_SKIN.themeDefault.id);
  const [demoCampos, setDemoCampos] = useState<DemoCampos | null>(null);
  const [savingDemo, setSavingDemo] = useState(false);
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
        const form = demoFormFromLead(leadData);
        setDemoSkinId(form.skinId);
        setDemoThemeId(form.themeId);
        setDemoCampos(form.campos);
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

  function handleSkinChange(skinId: string) {
    if (!lead) return;
    const form = demoFormFromLead(lead, skinId);
    setDemoSkinId(form.skinId);
    setDemoThemeId(form.themeId);
    setDemoCampos(form.campos);
    setDemoAviso(null);
    setDemoErro(null);
  }

  async function handleSaveDemo() {
    if (!lead || !demoCampos) return;
    setSavingDemo(true);
    setDemoErro(null);
    setDemoAviso(null);
    try {
      const skin = getSkin(demoSkinId) ?? DEFAULT_SKIN;
      // Overrides = só o que difere da base (exemplo ← dados do lead).
      // Campo esvaziado volta ao padrão. Edições avançadas já salvas via
      // API (serviços, seções, imagens…) são preservadas.
      const base = montarDemoData(skin.demoDataExemplo, lead);
      const dados: Record<string, string> = {};
      for (const { chave } of DEMO_CAMPOS) {
        const valor = demoCampos[chave].trim();
        if (valor && valor !== (base[chave] ?? "")) dados[chave] = valor;
      }
      const salvas = lead.demo?.skinId === skin.id ? { ...lead.demo.dados } : {};
      for (const { chave } of DEMO_CAMPOS) delete salvas[chave];
      const { lead: updated } = await api.putLeadDemo(id, {
        skinId: skin.id,
        themeId: demoThemeId,
        dados: { ...salvas, ...dados } as DemoDataPatch,
      });
      setLead(updated);
      setDemoAviso("Demo salva.");
    } catch (error) {
      setDemoErro(error instanceof ApiError ? error.message : "Falha ao salvar a demo.");
    } finally {
      setSavingDemo(false);
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
  const skinAtual = getSkin(demoSkinId) ?? DEFAULT_SKIN;
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
          <a
            href={demoUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-accent hover:underline"
          >
            Abrir demo ↗
          </a>
        </div>
        <p className="mt-1 text-xs text-ink-muted">
          Prévia pública do site em <code className="font-mono">/demo/{lead.placeId}</code> —
          funciona mesmo sem salvar. Use <code className="font-mono">{"{demo}"}</code> na
          mensagem do WhatsApp para enviar o link.
        </p>
        {demoCampos && (
          <div className="mt-3 flex flex-col gap-3">
            <label className="flex flex-col gap-1 text-xs text-ink-muted">
              Skin
              <select
                value={demoSkinId}
                onChange={(e) => handleSkinChange(e.target.value)}
                className="w-full rounded border border-line bg-surface-2 px-2 py-2 text-sm text-foreground outline-none focus:border-accent"
              >
                {SKINS.map((skin) => (
                  <option key={skin.id} value={skin.id}>
                    {skin.nome} ({skin.nicho})
                  </option>
                ))}
              </select>
            </label>

            <div>
              <span className="text-xs text-ink-muted">Tema</span>
              <div className="mt-1 flex flex-wrap gap-2">
                {skinAtual.themePresets.map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => setDemoThemeId(preset.id)}
                    aria-pressed={demoThemeId === preset.id}
                    className={`flex items-center gap-2 rounded border px-3 py-1.5 text-xs transition-colors ${
                      demoThemeId === preset.id
                        ? "border-accent text-foreground"
                        : "border-line text-ink-muted hover:border-accent/50"
                    }`}
                  >
                    <span className="flex overflow-hidden rounded-sm border border-line">
                      <span className="h-3 w-3" style={{ background: preset.paleta.fundo }} />
                      <span className="h-3 w-3" style={{ background: preset.paleta.destaque }} />
                      <span className="h-3 w-3" style={{ background: preset.paleta.texto }} />
                    </span>
                    {preset.nome}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {DEMO_CAMPOS.map(({ chave, rotulo }) => (
                <label key={chave} className="flex flex-col gap-1 text-xs text-ink-muted">
                  {rotulo}
                  <input
                    value={demoCampos[chave]}
                    onChange={(e) => setDemoCampos({ ...demoCampos, [chave]: e.target.value })}
                    className="w-full rounded border border-line bg-surface-2 px-3 py-2 text-sm text-foreground outline-none focus:border-accent"
                  />
                </label>
              ))}
            </div>
            <p className="text-xs text-ink-muted">
              Campo esvaziado volta ao padrão do template ao salvar.
            </p>

            <div className="flex flex-wrap items-center gap-2">
              <Button onClick={handleSaveDemo} loading={savingDemo}>
                Salvar demo
              </Button>
              <Button variant="secondary" onClick={handleCopyDemoLink}>
                Copiar link
              </Button>
              {demoAviso && <span className="text-xs text-good">{demoAviso}</span>}
            </div>
            {demoErro && <p className="text-sm text-critical">{demoErro}</p>}
            {lead.demo && (
              <p className="text-xs text-ink-muted">
                Demo salva em {formatDateTime(lead.demo.atualizadoEm)}.
              </p>
            )}
          </div>
        )}
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
