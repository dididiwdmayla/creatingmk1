"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { ConfirmModal } from "@/components/ConfirmModal";
import { MetaProgresso } from "@/components/MetaProgresso";
import { SeloContato } from "@/components/SeloContato";
import { StatusBadge } from "@/components/StatusBadge";
import { ApiError, api, type FrasesResponse, type HojeResponse } from "@/lib/api-client";
import { penetracaoParaLead } from "@/lib/buscas/penetracao";
import { envioVigente } from "@/lib/demos/envio";
import type { NomesUsuarios } from "@/lib/contato-selo";
import { formatDateTime, formatInt, formatTempoRelativo } from "@/lib/format";
import { comIndiceAtualizado, resolverMensagem } from "@/lib/frases/resolver";
import { ultimaAberturaNaoInterna } from "@/lib/leads/hoje";
import { melhorMomento } from "@/lib/leads/horarios";
import { argumentoForte, argumentoPenetracao } from "@/lib/leads/penetracao";
import { calculaScore } from "@/lib/leads/score";
import type { Lead } from "@/lib/leads/types";
import { useWhatsAppContato } from "@/lib/useWhatsAppContato";
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

/**
 * Mesma precedência da ficha, na mesma função pura (frases do nicho →
 * genéricas → mensagem do grupo → global). A fila não tem caixa de edição:
 * aqui a frase da vez vai direto para o link.
 */
function mensagemParaLead(
  lead: Lead,
  porId: Map<string, BuscaResumo>,
  global: string,
  frases: FrasesResponse | null,
): string {
  return resolverMensagem({
    lead,
    buscas: [...porId.values()],
    conjuntos: frases?.conjuntos ?? [],
    genericas: frases?.genericas,
    global,
  }).texto;
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
  const [meuId, setMeuId] = useState<string | null>(null);
  const [nomes, setNomes] = useState<NomesUsuarios>({});
  const [frases, setFrases] = useState<FrasesResponse | null>(null);

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
    api
      .me()
      .then(({ usuario }) => {
        if (!ignore) setMeuId(usuario.id);
      })
      .catch(() => {
        // selo/confirmação ficam indisponíveis sem sessão identificável
      });
    api
      .listNomesUsuarios()
      .then(({ usuarios }) => {
        if (!ignore) setNomes(Object.fromEntries(usuarios.map((u) => [u.id, u.nome])));
      })
      .catch(() => {
        // selo cai no fallback "usuário removido" — não é bloqueante
      });
    api
      .listFrases()
      .then((resposta) => {
        if (!ignore) setFrases(resposta);
      })
      .catch(() => {
        // sem as frases a precedência cai no grupo/global — a fila não quebra
      });
    return () => {
      ignore = true;
    };
  }, []);

  function onLeadChange(atualizado: Lead) {
    setDados((atual) => {
      if (!atual) return atual;
      const substituir = (leads: Lead[]) =>
        leads.map((lead) => (lead.placeId === atualizado.placeId ? atualizado : lead));
      return {
        ...atual,
        novos: substituir(atual.novos),
        followUps: substituir(atual.followUps),
        demosParadas: substituir(atual.demosParadas),
        abriramNaoResponderam: substituir(atual.abriramNaoResponderam),
      };
    });
  }

  /**
   * O envio aconteceu (ver useWhatsAppContato): gira a rotação do conjunto
   * que forneceu a frase deste lead. O contador é o mesmo da ficha — o
   * clique aqui e o clique lá alimentam a mesma sequência.
   */
  function handleEnviado(lead: Lead) {
    if (!dados) return;
    const rotacao = resolverMensagem({
      lead,
      buscas: dados.buscas,
      conjuntos: frases?.conjuntos ?? [],
      genericas: frases?.genericas,
      global: dados.mensagemPadrao,
    }).rotacao;
    if (!rotacao) return;
    api
      .avancarFrase(rotacao.nicho)
      .then(({ indice }) => setFrases((atual) => comIndiceAtualizado(atual, rotacao.nicho, indice)))
      .catch(() => {
        // rotação é cortesia, como o selo: falhar aqui não desfaz o envio
      });
  }

  const { pendente, clicar, confirmar, cancelar, mensagemConfirmacao } = useWhatsAppContato(
    meuId,
    onLeadChange,
    handleEnviado,
  );

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
    dados.demosParadas.length === 0 &&
    dados.abriramNaoResponderam.length === 0;

  return (
    <div className="flex flex-col gap-6">
      <section>
        <h1 className="font-display text-2xl font-bold text-foreground">Hoje</h1>
        <p className="mt-1 text-sm text-ink-secondary">
          {formatInt(dados.novos.length)} novo(s) · {formatInt(dados.followUps.length)}{" "}
          follow-up(s) · {formatInt(dados.demosParadas.length)} demo(s) parada(s) ·{" "}
          {formatInt(dados.abriramNaoResponderam.length)} abriram e não responderam
        </p>
        {dados.novosDesde && (
          <p className="mt-0.5 text-xs text-ink-muted">
            novos desde a sua última visita ({formatDateTime(dados.novosDesde)})
          </p>
        )}
      </section>

      {(dados.metaProspeccao.dia.meta !== undefined ||
        dados.metaProspeccao.semana.meta !== undefined) && (
        <section className="rounded-lg border border-line bg-surface p-4">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
            Sua meta de prospecção
          </h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {dados.metaProspeccao.dia.meta !== undefined && (
              <MetaProgresso
                label="Hoje"
                usado={dados.metaProspeccao.dia.usado}
                meta={dados.metaProspeccao.dia.meta}
              />
            )}
            {dados.metaProspeccao.semana.meta !== undefined && (
              <MetaProgresso
                label="Semana"
                usado={dados.metaProspeccao.semana.usado}
                meta={dados.metaProspeccao.semana.meta}
              />
            )}
          </div>
        </section>
      )}

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
              frases={frases}
              nomes={nomes}
              onWhatsAppClick={clicar}
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
              frases={frases}
              nomes={nomes}
              onWhatsAppClick={clicar}
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
              frases={frases}
              nomes={nomes}
              onWhatsAppClick={clicar}
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

      {dados.abriramNaoResponderam.length > 0 && (
        <Secao
          titulo={`Abriram e não responderam (${dados.abriramNaoResponderam.length})`}
          subtitulo="abriram a demo, mas o status continua contactado — nada muda sozinho aqui"
        >
          {dados.abriramNaoResponderam.map((lead) => (
            <ItemHoje
              key={lead.placeId}
              lead={lead}
              porId={porId}
              mensagemGlobal={dados.mensagemPadrao}
              frases={frases}
              nomes={nomes}
              onWhatsAppClick={clicar}
              extra={
                <span className="rounded-full bg-good/15 px-1.5 py-0.5 text-[10px] font-semibold text-good">
                  abriu {formatTempoRelativo(ultimaAberturaNaoInterna(lead) ?? lead.criadoEm, agora)}
                </span>
              }
            />
          ))}
        </Secao>
      )}

      <ConfirmModal
        aberto={pendente !== null}
        titulo="Lead já contatado"
        mensagem={mensagemConfirmacao(nomes) ?? ""}
        confirmarLabel="Contatar mesmo assim"
        onConfirmar={confirmar}
        onCancelar={cancelar}
      />
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
  frases,
  nomes,
  onWhatsAppClick,
  extra,
}: {
  lead: Lead;
  porId: Map<string, BuscaResumo>;
  mensagemGlobal: string;
  /** Conjuntos de frases por nicho; null enquanto carrega ou se a leitura falhou. */
  frases: FrasesResponse | null;
  nomes: NomesUsuarios;
  onWhatsAppClick: (event: { preventDefault: () => void }, lead: Lead, href: string) => void;
  extra?: React.ReactNode;
}) {
  const origem = buscaDeOrigem(lead, porId);
  const momento = melhorMomento(lead.horarios);
  const telefoneIntl = lead.detalhes?.telefoneIntl ?? lead.telefoneIntl;
  const demoUrl =
    lead.demo && typeof window !== "undefined"
      ? `${window.location.origin}/demo/${lead.placeId}`
      : undefined;
  // A variável {demo} carrega o token vigente do canal "whatsapp" (já vem
  // no GET /api/hoje, sem fetch no clique); o link "Demo" do item continua
  // sem token (preview).
  const tokenVigente = envioVigente(lead.demo, "whatsapp")?.token;
  const demoUrlParaEnvio = demoUrl && tokenVigente ? `${demoUrl}?t=${tokenVigente}` : demoUrl;
  // Penetração de site do nicho+região do lead (cacheada no doc da busca) —
  // alimenta a variável {penetracao} e o badge "argumento forte" (>60%).
  const penetracaoInfo = penetracaoParaLead(lead, [...porId.values()]);
  const argumentoTexto =
    penetracaoInfo && lead.siteProprio === false
      ? argumentoPenetracao(penetracaoInfo.nicho, penetracaoInfo.regiao, penetracaoInfo.penetracao, lead.nome)
      : undefined;
  const waHref = telefoneIntl
    ? buildWhatsAppLink(mensagemParaLead(lead, porId, mensagemGlobal, frases), lead.nome, telefoneIntl, {
        demoUrl: demoUrlParaEnvio,
        penetracao: argumentoTexto,
      })
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
          {penetracaoInfo && argumentoForte(penetracaoInfo.penetracao) && (
            <span
              title="Mais de 60% da concorrência do nicho já tem site — argumento forte"
              className="rounded-full bg-warning/15 px-1.5 py-0.5 text-[10px] font-semibold text-warning"
            >
              argumento forte
            </span>
          )}
          <StatusBadge status={lead.status} />
        </div>
      </div>

      {lead.seloContato && (
        <div className="mt-2">
          <SeloContato lead={lead} nomes={nomes} />
        </div>
      )}

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
          {momento && (
            <span className={momento.agora ? "font-semibold text-good" : "text-ink-muted"}>
              {momento.agora ? "melhor momento: agora" : `melhor momento: ${momento.texto}`}
            </span>
          )}
          {waHref && (
            <a
              href={waHref}
              onClick={(event) => onWhatsAppClick(event, lead, waHref)}
              target="_blank"
              rel="noopener noreferrer"
              className={
                momento?.agora
                  ? "font-semibold text-good underline decoration-2 underline-offset-2"
                  : "font-semibold text-good hover:underline"
              }
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
