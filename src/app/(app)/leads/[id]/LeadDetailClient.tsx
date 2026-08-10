"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { Button } from "@/components/Button";
import { CapturasSecao } from "@/components/capturas/CapturasSecao";
import { ConfirmModal } from "@/components/ConfirmModal";
import { CotaIndicador, cotaEsgotada } from "@/components/CotaIndicador";
import { PrecificacaoCard } from "@/components/PrecificacaoCard";
import { SeloContato } from "@/components/SeloContato";
import { SeloProntidao } from "@/components/SeloProntidao";
import { Skeleton, SkeletonRows } from "@/components/Skeleton";
import { StatusBadge } from "@/components/StatusBadge";
import { ApiError, api, type FrasesResponse } from "@/lib/api-client";
import { penetracaoParaLead } from "@/lib/buscas/penetracao";
import type { Busca } from "@/lib/buscas/types";
import type { AppConfig } from "@/lib/config";
import { nomeUsuario, type NomesUsuarios } from "@/lib/contato-selo";
import type { UsoUsuario } from "@/lib/costs";
import { demoUrlComToken, envioVigente } from "@/lib/demos/envio";
import { getSkin, getTheme } from "@/lib/demos/registry";
import { formatBRL, formatDateTime, formatDuracao } from "@/lib/format";
import { projecaoTraducao } from "@/lib/frases/custoTraducao";
import {
  comConjuntoAtualizado,
  comIndiceAtualizado,
  resolverMensagem,
  rotuloOrigem,
} from "@/lib/frases/resolver";
import { idiomaLabelRegional } from "@/lib/idioma";
import { estadoAtual, melhorMomento } from "@/lib/leads/horarios";
import { handleInstagram } from "@/lib/leads/instagram";
import { argumentoForte, argumentoPenetracao } from "@/lib/leads/penetracao";
import { VALID_TRANSITIONS, type Lead, type LeadStatus } from "@/lib/leads/types";
import { useWhatsAppContato } from "@/lib/useWhatsAppContato";
import { aplicarMarcadores, linkWhatsApp } from "@/lib/wa";

/**
 * Texto da confirmação da tradução: quantas chamadas e quanto custa, ANTES
 * do OK. Sem o uso do mês em mãos (falha do /api/usage), diz isso em vez de
 * inventar um número — o teto real quem aplica é o servidor.
 */
function mensagemTraducao(
  idioma: string | undefined,
  config: AppConfig | null,
  uso: { usado: number; teto: number } | null,
): string {
  const alvo = idioma ? idiomaLabelRegional(idioma) : "o idioma do lead";
  const base = `As 3 frases da skin vão para ${alvo} numa única chamada de IA (até 2 se a resposta vier fora do formato). A tradução fica gravada e passa a valer para todo lead deste idioma nesta skin — só é refeita se você mandar.`;
  if (!config || !uso) {
    return `${base} Não deu pra carregar a cota de tradução do mês — o servidor ainda barra se o teto estourar.`;
  }

  const projecao = projecaoTraducao(
    uso.usado,
    uso.teto,
    {
      usdPer1000: config.precos.usdPor1000.aiTraducao,
      freeQuota: config.precos.cotaGratis.aiTraducao,
    },
    config.precos.usdBrl,
  );
  const custo =
    projecao.custoBRL.maximo === projecao.custoBRL.minimo
      ? formatBRL(projecao.custoBRL.minimo)
      : `${formatBRL(projecao.custoBRL.minimo)}–${formatBRL(projecao.custoBRL.maximo)}`;
  const estouro = projecao.podeEstourar
    ? " Atenção: o pior caso passa do teto do mês e o servidor pode recusar."
    : "";
  return `${base} Custo: ${custo}. Traduções este mês: ${uso.usado}/${uso.teto}.${estouro}`;
}

const TRANSITION_LABELS: Record<LeadStatus, string> = {
  novo: "Marcar como novo",
  contactado: "Marcar como contactado",
  respondeu: "Marcar como respondeu",
  fechado: "Marcar como fechado",
};

export function LeadDetailClient({ id }: { id: string }) {
  const [lead, setLead] = useState<Lead | null>(null);
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [buscas, setBuscas] = useState<Busca[]>([]);
  const [frases, setFrases] = useState<FrasesResponse | null>(null);
  // Edição livre da frase antes de disparar. null = ainda não editada (a
  // caixa mostra a frase da vez); qualquer string = o que você digitou.
  const [rascunho, setRascunho] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [enriching, setEnriching] = useState(false);
  const [enrichErro, setEnrichErro] = useState<string | null>(null);
  const [buscandoHorarios, setBuscandoHorarios] = useState(false);
  const [horariosErro, setHorariosErro] = useState<string | null>(null);
  const [changingTo, setChangingTo] = useState<LeadStatus | null>(null);
  const [salvandoVendedor, setSalvandoVendedor] = useState(false);
  const [vendedorErro, setVendedorErro] = useState<string | null>(null);
  const [descartando, setDescartando] = useState(false);
  const [demoErro, setDemoErro] = useState<string | null>(null);
  const [demoAviso, setDemoAviso] = useState<string | null>(null);
  const [argumentoAviso, setArgumentoAviso] = useState<string | null>(null);

  // Tradução das frases (chamada PAGA, SKU aiTraducao): nunca dispara
  // sozinha — abre a confirmação com chamadas e custo, e só o OK chama.
  const [confirmandoTraducao, setConfirmandoTraducao] = useState(false);
  const [usoTraducao, setUsoTraducao] = useState<{ usado: number; teto: number } | null>(null);
  const [traduzindo, setTraduzindo] = useState(false);
  const [traducaoErro, setTraducaoErro] = useState<string | null>(null);

  // Selo de contato (item independente do status): quem sou eu + nomes pra
  // resolver o selo/badge, e se sou admin (ajuste do vendedor do fechamento).
  const [meuId, setMeuId] = useState<string | null>(null);
  const [souAdmin, setSouAdmin] = useState(false);
  const [nomes, setNomes] = useState<NomesUsuarios>({});

  // Cota individual de enriquecimentos — indicador permanente junto do botão.
  const [cotaEnrich, setCotaEnrich] = useState<UsoUsuario | null>(null);
  function recarregarCotaEnrich() {
    api
      .getCotas()
      .then(({ enriquecimentos }) => setCotaEnrich(enriquecimentos))
      .catch(() => {
        // indicador é cortesia — o bloqueio real é do servidor
      });
  }

  useEffect(() => {
    let ignore = false;
    Promise.all([
      api.getLead(id),
      api.getConfig(),
      api.listBuscas(),
      // Frases junto do resto para a caixa já nascer com a frase da vez (sem
      // troca de texto depois do primeiro desenho), mas com catch próprio:
      // se elas falharem, a precedência cai no grupo/global e a ficha abre
      // normalmente — nunca vira página de erro por causa disto.
      api.listFrases().catch(() => null),
    ])
      .then(([{ lead: leadData }, { config: configData }, { buscas: buscasData }, frasesData]) => {
        if (ignore) return;
        setLead(leadData);
        setConfig(configData);
        setBuscas(buscasData);
        setFrases(frasesData);
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
    api
      .getCotas()
      .then(({ enriquecimentos }) => {
        if (!ignore) setCotaEnrich(enriquecimentos);
      })
      .catch(() => {
        // indicador é cortesia — o bloqueio real é do servidor
      });
    api
      .me()
      .then(({ usuario }) => {
        if (ignore) return;
        setMeuId(usuario.id);
        setSouAdmin(usuario.papel === "admin");
      })
      .catch(() => {
        // sem sessão identificável: selo/ajuste ficam indisponíveis, sem erro fatal
      });
    api
      .listNomesUsuarios()
      .then(({ usuarios }) => {
        if (!ignore) setNomes(Object.fromEntries(usuarios.map((u) => [u.id, u.nome])));
      })
      .catch(() => {
        // selo cai no fallback "usuário removido" — não é bloqueante
      });
    return () => {
      ignore = true;
    };
  }, [id]);

  // Resolvida no corpo do componente (função pura, sem efeito): frases da
  // skin da demo → mensagem do grupo → mensagem global. Sem demo, a
  // precedência começa no grupo — e a caixa passa a mostrar a frase da skin
  // sozinha assim que o lead ganha uma demo.
  const resolvida =
    lead && config
      ? resolverMensagem({
          lead,
          buscas,
          conjuntos: frases?.conjuntos ?? [],
          global: config.mensagemPadrao,
        })
      : null;

  /**
   * O ENVIO aconteceu (ver useWhatsAppContato): gira a rotação do conjunto
   * que forneceu a frase e devolve a caixa para a frase da vez seguinte.
   * Mensagem de grupo/global não tem rotação — nada a girar.
   */
  function handleEnviado() {
    const rotacao = resolvida?.rotacao;
    if (!rotacao) return;
    setRascunho(null);
    api
      .avancarFrase(rotacao.skinId)
      .then(({ indice }) =>
        setFrases((atual) => comIndiceAtualizado(atual, rotacao.skinId, indice)),
      )
      .catch(() => {
        // rotação é cortesia, como o selo: falhar aqui não desfaz o envio
      });
  }

  const { pendente, clicar, confirmar, cancelar, mensagemConfirmacao } = useWhatsAppContato(
    meuId,
    setLead,
    handleEnviado,
  );

  /**
   * Abre a confirmação da tradução e busca o uso do mês só aí — o custo
   * precisa estar na tela ANTES do OK, e nada é chamado enquanto ele não
   * vier (ou falhar, e aí o texto avisa que o servidor é quem barra).
   */
  function abrirConfirmacaoTraducao() {
    if (traduzindo) return;
    setTraducaoErro(null);
    api
      .getUsage()
      .then(({ usage, caps }) => setUsoTraducao({ usado: usage.aiTraducao, teto: caps.aiTraducao }))
      .catch(() => setUsoTraducao(null));
    setConfirmandoTraducao(true);
  }

  async function traduzir() {
    setConfirmandoTraducao(false);
    setTraduzindo(true);
    setTraducaoErro(null);
    try {
      const { conjunto } = await api.traduzirFrases(id);
      // A tradução gravada entra no estado local: a caixa passa a mostrar o
      // texto no idioma do lead sem recarregar a ficha.
      setFrases((atual) => comConjuntoAtualizado(atual, conjunto));
      setRascunho(null);
    } catch (error) {
      setTraducaoErro(
        error instanceof ApiError && error.code === "quota_exceeded"
          ? `Teto mensal de traduções atingido (${error.extra.used}/${error.extra.cap} em ${error.extra.period}).`
          : error instanceof ApiError
            ? error.message
            : "Falha ao traduzir as frases.",
      );
    } finally {
      setTraduzindo(false);
    }
  }

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
      } else if (error instanceof ApiError && error.code === "user_quota_exceeded") {
        const janela = error.extra.janela as string;
        const janelaLabel = janela === "dia" ? "diário" : janela === "semana" ? "semanal" : "mensal";
        setEnrichErro(
          `Limite ${janelaLabel} de enriquecimentos atingido (${error.extra.used}/${error.extra.limite}). ` +
            `Reseta em ${formatDateTime(error.extra.resetaEm as string)}.`,
        );
      } else if (error instanceof ApiError && error.code === "places_error") {
        setEnrichErro(`Erro do Google: ${error.extra.detail ?? error.message}`);
      } else {
        setEnrichErro(error instanceof ApiError ? error.message : "Falha ao enriquecer.");
      }
    } finally {
      setEnriching(false);
      recarregarCotaEnrich();
    }
  }

  async function handleBuscarHorarios() {
    setBuscandoHorarios(true);
    setHorariosErro(null);
    try {
      const { lead: updated } = await api.buscarHorarios(id);
      setLead(updated);
    } catch (error) {
      setHorariosErro(
        error instanceof ApiError ? error.message : "Falha ao buscar horários.",
      );
    } finally {
      setBuscandoHorarios(false);
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

  async function handleVendidoPor(novoId: string) {
    if (!novoId) return;
    setSalvandoVendedor(true);
    setVendedorErro(null);
    try {
      const { lead: updated } = await api.patchLead(id, { vendidoPor: novoId });
      setLead(updated);
    } catch (error) {
      setVendedorErro(error instanceof ApiError ? error.message : "Falha ao ajustar o vendedor.");
    } finally {
      setSalvandoVendedor(false);
    }
  }

  async function handleCopyDemoLink() {
    try {
      // Canal "link", separado do "whatsapp" — copiar o link não queima o
      // token que já pode estar na mensagem de WhatsApp montada (ver
      // EnvioDemo.canal em lib/demos/types.ts).
      const tokenLink = lead ? envioVigente(lead.demo, "link")?.token : undefined;
      const url = demoUrlComToken(window.location.origin, id, tokenLink);
      await navigator.clipboard.writeText(url);
      setDemoAviso("Link copiado!");
      setDemoErro(null);
    } catch {
      setDemoErro("Não deu pra copiar — copie da barra de endereço da demo.");
    }
  }

  async function handleCopyArgumento(texto: string) {
    try {
      await navigator.clipboard.writeText(texto);
      setArgumentoAviso("Copiado!");
    } catch {
      setArgumentoAviso(null);
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
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-8 w-2/3" />
        <Skeleton className="h-4 w-1/2" />
        <SkeletonRows count={3} className="h-16 rounded-lg border border-line" />
      </div>
    );
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
  // "Abrir demo" (preview) sempre usa a URL sem token. "Copiar link" e a
  // variável {demo} da mensagem de WhatsApp usam, cada um, o token vigente
  // do seu próprio canal — já prontos no GET do lead (sem fetch no clique).
  const demoUrl = `${window.location.origin}/demo/${lead.placeId}`;
  const tokenVigente = envioVigente(lead.demo, "whatsapp")?.token;
  const demoUrlParaEnvio = tokenVigente ? `${demoUrl}?t=${tokenVigente}` : demoUrl;
  const skinAtual = getSkin(lead.demo?.skinId);
  // Timeline: só visitas de fora do time (preview do próprio time não conta
  // como "o lead abriu"), a mais recente primeiro.
  const visitasExternas = [...(lead.demoVisitas ?? [])]
    .filter((visita) => !visita.interna)
    .sort((a, b) => b.em.localeCompare(a.em));
  // Derivado no servidor (asLead): true = site próprio; false = sem site OU
  // só rede social/agregador; undefined = desconhecido.
  const siteEhProprio = lead.siteProprio;
  const instagramHandle = handleInstagram(detalhes?.site ?? lead.siteUrl);
  const estado = estadoAtual(lead.horarios);
  const momento = melhorMomento(lead.horarios);

  // Argumento de venda pronto: só para leads sem site próprio, e só quando
  // a penetração do nicho+região dele já foi calculada (busca que o trouxe
  // já rodou pelo menos uma vez com o agregado cacheado).
  const penetracaoInfo = penetracaoParaLead(lead, buscas);
  const argumento =
    penetracaoInfo && siteEhProprio === false
      ? argumentoPenetracao(penetracaoInfo.nicho, penetracaoInfo.regiao, penetracaoInfo.penetracao, lead.nome)
      : undefined;

  // A frase da vez com os marcadores JÁ substituídos — é o que aparece na
  // caixa ao abrir a ficha. O que você digitar por cima (`rascunho`) vence
  // até o próximo envio, e é ele que vai no link.
  const mensagemDaVez = resolvida
    ? aplicarMarcadores(resolvida.texto, lead.nome, {
        demoUrl: demoUrlParaEnvio,
        penetracao: argumento,
      })
    : "";
  const mensagemParaEnviar = rascunho ?? mensagemDaVez;
  const waLink = telefoneIntl ? linkWhatsApp(mensagemParaEnviar, telefoneIntl) : null;

  return (
    <div className="flex flex-col gap-5">
      <div>
        <Link href="/leads" className="text-xs text-ink-muted hover:text-foreground">
          ← Leads
        </Link>
        <div className="mt-2 flex items-start justify-between gap-2">
          <h1 className="font-display text-xl font-bold text-foreground">{lead.nome}</h1>
          <StatusBadge status={lead.status} />
        </div>
        {lead.endereco && <p className="mt-1 text-sm text-ink-secondary">{lead.endereco}</p>}
        {instagramHandle && (
          <a
            href={`https://instagram.com/${instagramHandle}`}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2 inline-flex items-center gap-2 rounded border border-line bg-surface-2 py-1.5 pl-1.5 pr-3 text-sm font-medium text-foreground hover:border-accent/40 hover:bg-surface-2/70"
          >
            <IconeInstagram />
            <span>
              @{instagramHandle} <span aria-hidden>↗</span>
            </span>
          </a>
        )}
        {lead.descartado && (
          <p className="mt-2 inline-block rounded border border-critical/40 bg-critical/10 px-2 py-1 text-xs text-critical">
            Lead descartado — continua na base e pode ser restaurado.
          </p>
        )}
      </div>

      <section className="rounded-lg border border-line bg-surface p-4">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
            Detalhes
          </h2>
          {lead.enriquecido && !lead.horarios && (
            <button
              type="button"
              onClick={handleBuscarHorarios}
              disabled={buscandoHorarios}
              className="text-xs text-ink-muted hover:text-accent disabled:opacity-50"
            >
              {buscandoHorarios ? "Buscando…" : "buscar horários"}
            </button>
          )}
        </div>
        {cotaEnrich && (
          <div className="mt-1.5">
            <CotaIndicador titulo="Sua cota de enriquecimento" uso={cotaEnrich} />
          </div>
        )}
        {estado && (
          <p className={`mt-2 text-sm font-medium ${estado.aberto ? "text-good" : "text-ink-muted"}`}>
            {estado.texto}
          </p>
        )}
        {horariosErro && <p className="mt-1 text-xs text-critical">{horariosErro}</p>}
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
            <Button
              onClick={handleEnrich}
              loading={enriching}
              disabled={cotaEsgotada(cotaEnrich)}
              className="mt-3"
            >
              Enriquecer
            </Button>
            {enrichErro && <p className="mt-2 text-sm text-critical">{enrichErro}</p>}
          </div>
        )}
      </section>

      {argumento && penetracaoInfo && (
        <section className="rounded-lg border border-line bg-surface p-4">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
              Argumento de venda
            </h2>
            {argumentoForte(penetracaoInfo.penetracao) && (
              <span
                title="Mais de 60% da concorrência do nicho já tem site — argumento forte"
                className="shrink-0 rounded-full bg-warning/15 px-1.5 py-0.5 text-[10px] font-semibold text-warning"
              >
                argumento forte
              </span>
            )}
          </div>
          <p className="mt-2 text-sm text-ink-secondary">{argumento}</p>
          <div className="mt-2 flex items-center gap-2">
            <Button variant="secondary" onClick={() => handleCopyArgumento(argumento)}>
              Copiar
            </Button>
            {argumentoAviso && <span className="text-xs text-good">{argumentoAviso}</span>}
          </div>
          <p className="mt-2 text-xs text-ink-muted">
            Use <code className="font-mono">{"{penetracao}"}</code> na mensagem do WhatsApp para
            incluir esta linha automaticamente.
          </p>
        </section>
      )}

      <PrecificacaoCard nicho={lead.busca?.nicho ?? ""} regiaoTexto={lead.busca?.regiao} />

      <SeloContato lead={lead} nomes={nomes} />

      {waLink && (
        <div className="flex flex-col gap-1.5">
          <section className="rounded-lg border border-line bg-surface p-4">
            <div className="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-1">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
                Mensagem do WhatsApp
              </h2>
              {resolvida && (
                <span className="text-[11px] text-ink-muted">{rotuloOrigem(resolvida)}</span>
              )}
            </div>
            {/*
              Marcadores já substituídos: o que está aqui é literalmente o
              que vai ser enviado. Editar à vontade antes de disparar — a
              edição vale só para este envio e NÃO gira a rotação (quem gira
              é o clique no botão abaixo).
            */}
            <textarea
              value={mensagemParaEnviar}
              onChange={(event) => setRascunho(event.target.value)}
              rows={4}
              aria-label="Mensagem do WhatsApp"
              className="mt-2 w-full rounded border border-line bg-surface-2 px-3 py-2 text-sm text-foreground outline-none focus:border-accent"
            />
            {rascunho !== null && rascunho !== mensagemDaVez && (
              <button
                type="button"
                onClick={() => setRascunho(null)}
                className="mt-1 text-xs text-ink-muted hover:text-accent"
              >
                voltar à frase da vez
              </button>
            )}
            {/*
              Lead de fora do Brasil: as frases são sempre escritas em
              português, e a tradução é um clique explícito (chamada paga).
              Traduzida, a linha só informa — e a caixa acima já está no
              idioma dele. Editada depois, ela volta a oferecer o botão.
            */}
            {resolvida?.traducao && (
              <div className="mt-2 flex flex-wrap items-center gap-2 border-t border-line pt-2">
                {resolvida.traducao.estado === "aplicada" ? (
                  <span className="text-[11px] text-good">
                    traduzida para {idiomaLabelRegional(resolvida.traducao.idioma)}
                  </span>
                ) : (
                  <>
                    <span className="text-[11px] text-ink-muted">
                      {resolvida.traducao.estado === "desatualizada"
                        ? `a frase mudou depois da tradução — indo em português para este lead de ${idiomaLabelRegional(resolvida.traducao.idioma)}`
                        : `lead de ${idiomaLabelRegional(resolvida.traducao.idioma)} — a frase vai em português`}
                    </span>
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={abrirConfirmacaoTraducao}
                      loading={traduzindo}
                    >
                      {resolvida.traducao.estado === "desatualizada"
                        ? "Traduzir de novo"
                        : "Traduzir com IA"}
                    </Button>
                  </>
                )}
              </div>
            )}
            {traducaoErro && <p className="mt-1 text-xs text-critical">{traducaoErro}</p>}
          </section>
          <a
            href={waLink}
            onClick={(event) => clicar(event, lead, waLink)}
            target="_blank"
            rel="noopener noreferrer"
            className={`rounded px-3 py-2 text-center text-sm font-semibold text-good-ink transition ${
              momento?.agora
                ? "bg-good ring-2 ring-good ring-offset-2 ring-offset-background hover:bg-good/90"
                : "bg-good/80 hover:bg-good"
            }`}
          >
            Chamar no WhatsApp
          </a>
          {momento && (
            <p
              className={`text-center text-xs ${momento.agora ? "font-medium text-good" : "text-ink-muted"}`}
            >
              Melhor momento pra contatar: {momento.agora ? "agora" : momento.texto}
            </p>
          )}
        </div>
      )}

      <ConfirmModal
        aberto={confirmandoTraducao}
        titulo="Traduzir as frases com IA"
        mensagem={mensagemTraducao(resolvida?.traducao?.idioma, config, usoTraducao)}
        confirmarLabel="Traduzir"
        onConfirmar={traduzir}
        onCancelar={() => setConfirmandoTraducao(false)}
      />

      <ConfirmModal
        aberto={pendente !== null}
        titulo="Lead já contatado"
        mensagem={mensagemConfirmacao(nomes) ?? ""}
        confirmarLabel="Contatar mesmo assim"
        onConfirmar={confirmar}
        onCancelar={cancelar}
      />

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
            <SeloProntidao lead={lead} skin={skinAtual} />
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
                href={`/leads/${lead.placeId}/demo/escolher`}
                className="inline-block rounded bg-accent px-3 py-2 text-sm font-medium text-accent-ink hover:bg-accent/90"
              >
                Criar demo
              </Link>
            </div>
          </div>
        )}
        {demoErro && <p className="mt-2 text-sm text-critical">{demoErro}</p>}
      </section>

      <CapturasSecao key={lead.placeId} lead={lead} />

      {visitasExternas.length > 0 && (
        <section className="rounded-lg border border-line bg-surface p-4">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
            Visitas à demo
          </h2>
          <p className="mt-0.5 text-xs text-ink-muted">
            aberturas de fora do time — preview do próprio time não entra aqui
          </p>
          <ul className="mt-3 flex flex-col gap-3">
            {visitasExternas.map((visita) => (
              <li
                key={visita.id}
                className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-sm"
              >
                <div>
                  <p className="text-foreground">{formatDateTime(visita.em)}</p>
                  <p className="text-xs text-ink-muted">
                    {visita.envioEm
                      ? `envio de ${formatDateTime(visita.envioEm)}`
                      : "envio não identificado"}
                  </p>
                  {visita.geo && (visita.geo.cidade || visita.geo.regiao || visita.geo.pais) && (
                    <p className="text-xs text-ink-muted">
                      {[visita.geo.cidade, visita.geo.regiao, visita.geo.pais]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  )}
                </div>
                <div className="text-right text-xs text-ink-secondary">
                  <p>
                    {visita.duracaoSegundos !== undefined
                      ? formatDuracao(visita.duracaoSegundos)
                      : "duração desconhecida"}
                  </p>
                  <p>
                    {visita.scrollPercent !== undefined
                      ? `${visita.scrollPercent}% da página`
                      : "scroll desconhecido"}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

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
            {lead.contato.fechadoEm && lead.contato.fechadoPor && (
              <Row label="Vendedor" value={nomeUsuario(nomes, lead.contato.fechadoPor)} compact />
            )}
          </dl>
        )}
        {lead.status === "fechado" && souAdmin && (
          <div className="mt-3 flex items-center gap-2">
            <label className="text-xs text-ink-muted" htmlFor="vendidoPor">
              Ajustar vendedor:
            </label>
            <select
              id="vendidoPor"
              value={lead.contato?.fechadoPor ?? ""}
              disabled={salvandoVendedor}
              onChange={(event) => handleVendidoPor(event.target.value)}
              className="rounded border border-line bg-surface-2 px-2 py-1 text-xs text-foreground outline-none focus:border-accent disabled:opacity-50"
            >
              <option value="" disabled>
                Selecione…
              </option>
              {Object.entries(nomes).map(([id, nome]) => (
                <option key={id} value={id}>
                  {nome}
                </option>
              ))}
            </select>
            {vendedorErro && <span className="text-xs text-critical">{vendedorErro}</span>}
          </div>
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

/**
 * Ícone do Instagram: o glifo da CÂMERA (moldura arredondada, lente e o
 * ponto do flash) sobre o arco roxo→magenta de `.cromo-instagram`, que é o
 * trecho final do arco iridescente do tema Prisma (ver globals.css).
 *
 * A fonte do logotipo da marca é PROPRIETÁRIA e por isso não aparece em
 * lugar nenhum daqui — quem identifica é o glifo mais a cor. O ladrilho
 * tem largura e altura explícitas, e o gradiente vive só dentro dele: o
 * rótulo fica fora, em superfície sólida, como manda a regra de
 * legibilidade (o teste `globals.legibilidade` cobra isso).
 */
function IconeInstagram() {
  return (
    <span
      aria-hidden
      className="cromo-instagram flex h-7 w-7 shrink-0 items-center justify-center rounded-lg"
    >
      <svg
        viewBox="0 0 24 24"
        className="h-4 w-4"
        fill="none"
        stroke="#ffffff"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <rect x="3" y="3" width="18" height="18" rx="5.5" />
        <circle cx="12" cy="12" r="4.2" />
        <circle cx="17.4" cy="6.6" r="1.1" fill="#ffffff" stroke="none" />
      </svg>
    </span>
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
