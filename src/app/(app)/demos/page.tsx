"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { Button } from "@/components/Button";
import { ConfirmModal } from "@/components/ConfirmModal";
import { SeloProntidao } from "@/components/SeloProntidao";
import { SkeletonRows } from "@/components/Skeleton";
import { ApiError, api } from "@/lib/api-client";
import { agruparPorBusca } from "@/lib/buscas/agrupar";
import type { Busca } from "@/lib/buscas/types";
import { nomeUsuario, type NomesUsuarios } from "@/lib/contato-selo";
import { demoUrlComToken, envioVigente } from "@/lib/demos/envio";
import { getSkin } from "@/lib/demos/registry";
import { formatDateTime, formatTempoRelativo } from "@/lib/format";
import { ultimaAberturaNaoInterna } from "@/lib/leads/hoje";
import type { Lead } from "@/lib/leads/types";

const SEM_AUTOR = "__sem_autor__";

type Ordenacao = "recentes" | "antigas";

const ORDENACOES: Array<{ valor: Ordenacao; label: string }> = [
  { valor: "recentes", label: "Mais recentes primeiro" },
  { valor: "antigas", label: "Mais antigas primeiro" },
];

/** Texto exato que precisa ser digitado para habilitar "Apagar todas do grupo". */
const FRASE_CONFIRMACAO_LOTE = "apagar todos";

/**
 * Todas as demos ativas (leads com `demo` salva): skin, datas de
 * criação/edição, link público copiável e atalhos para editar/excluir.
 * Reaproveita GET /api/leads (sem filtros) e filtra client-side — mesma
 * escala de "centenas de leads" do resto do app.
 *
 * Agrupamento por busca (nome/cor/colapso — mesmo padrão de `/leads`) e
 * filtro por autor (`LeadDemo.criadoPor`, combinável com o agrupamento —
 * filtra ANTES de agrupar, então um grupo sem nenhuma demo do autor
 * escolhido simplesmente não aparece): demos criadas em lote
 * (`GerarDemosLoteDialog`) nascem com o `buscaId` do próprio lead,
 * intocado pela criação da demo — então já caem sozinhas no grupo de
 * busca de origem, sem nenhum código específico de lote aqui.
 *
 * **Ordenação por `LeadDemo.criadoEm`** (select "Mais recentes primeiro" /
 * "Mais antigas primeiro", default recentes): ordena ANTES de agrupar —
 * com "Agrupar por busca" ligado, a ordem escolhida vale dentro de cada
 * grupo; a ordem dos grupos em si segue `buscas` (mais recente primeiro,
 * como `agruparPorBusca` já faz), intocada pelo seletor.
 *
 * **"Apagar todas do grupo"** (botão no cabeçalho de cada grupo, só com
 * "Agrupar por busca" ligado): visível e clicável só para admin (`api.me`
 * resolve `souAdmin` no mount; `DELETE /api/buscas/[id]/demos` recusa no
 * SERVIDOR pra quem não é — a tela nunca é a única trava). Abre
 * `ConfirmModal` com o nome do grupo e a contagem EXATA (`grupo.itens.length`
 * já vem do estado local, sem round-trip extra) e só habilita o botão de
 * confirmar depois de digitar `FRASE_CONFIRMACAO_LOTE` ("apagar todos")
 * exatamente — qualquer outro texto mantém desabilitado. A rota apaga só o
 * campo `demo` de cada lead do grupo (mesma semântica do DELETE individual):
 * lead, status, contato e `demoVisitas` (histórico de envio/visita)
 * continuam intactos — ver teste em `src/lib/leads/__tests__/deleteDemo.test.ts`.
 */
export default function DemosPage() {
  const [leads, setLeads] = useState<Lead[] | null>(null);
  const [buscas, setBuscas] = useState<Busca[]>([]);
  const [nomes, setNomes] = useState<NomesUsuarios>({});
  const [erro, setErro] = useState<string | null>(null);
  const [copiado, setCopiado] = useState<string | null>(null);
  const [confirmaExcluir, setConfirmaExcluir] = useState<string | null>(null);
  const [excluindo, setExcluindo] = useState<string | null>(null);
  // Instante fixo da carga, pro selo "aberta há X" (Date.now() no render é
  // impuro pro React Compiler — mesmo padrão de /hoje).
  const [agora, setAgora] = useState(0);

  const [agrupar, setAgrupar] = useState(true);
  const [fechados, setFechados] = useState<Set<string>>(new Set());
  const [filtroAutor, setFiltroAutor] = useState("");
  const [ordenacao, setOrdenacao] = useState<Ordenacao>("recentes");

  const [souAdmin, setSouAdmin] = useState(false);
  const [grupoParaApagar, setGrupoParaApagar] = useState<{ id: string; titulo: string; total: number } | null>(
    null,
  );
  const [textoConfirmacaoLote, setTextoConfirmacaoLote] = useState("");
  const [apagandoGrupo, setApagandoGrupo] = useState(false);
  const [avisoGrupo, setAvisoGrupo] = useState<string | null>(null);

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
    api
      .listBuscas()
      .then(({ buscas: data }) => {
        if (!ignore) setBuscas(data);
      })
      .catch(() => {
        // agrupamento degrada pra lista plana — não é erro fatal
      });
    api
      .listNomesUsuarios()
      .then(({ usuarios }) => {
        if (!ignore) {
          setNomes(Object.fromEntries(usuarios.map((u) => [u.id, u.nome])));
        }
      })
      .catch(() => {
        // filtro por autor degrada pra "usuário removido" — não é erro fatal
      });
    api
      .me()
      .then(({ usuario }) => {
        if (!ignore) setSouAdmin(usuario.papel === "admin");
      })
      .catch(() => {
        // sem sessão identificável: botão "Apagar todas do grupo" só fica oculto
      });
    return () => {
      ignore = true;
    };
  }, []);

  function toggleColapsado(chave: string) {
    setFechados((atual) => {
      const next = new Set(atual);
      if (next.has(chave)) next.delete(chave);
      else next.add(chave);
      return next;
    });
  }

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

  function abrirApagarGrupo(grupo: { id: string; titulo: string; total: number }) {
    setGrupoParaApagar(grupo);
    setTextoConfirmacaoLote("");
  }

  function fecharApagarGrupo() {
    if (apagandoGrupo) return;
    setGrupoParaApagar(null);
    setTextoConfirmacaoLote("");
  }

  async function confirmarApagarGrupo() {
    if (!grupoParaApagar || textoConfirmacaoLote !== FRASE_CONFIRMACAO_LOTE) return;
    setApagandoGrupo(true);
    try {
      const { apagadas } = await api.deleteDemosDoGrupo(grupoParaApagar.id);
      setLeads((atual) =>
        atual?.map((lead) =>
          (lead.buscaId ?? []).includes(grupoParaApagar.id) ? { ...lead, demo: undefined } : lead,
        ) ?? atual,
      );
      setAvisoGrupo(`${apagadas} demo${apagadas === 1 ? "" : "s"} apagada${apagadas === 1 ? "" : "s"} de "${grupoParaApagar.titulo}".`);
      setGrupoParaApagar(null);
      setTextoConfirmacaoLote("");
    } catch (error) {
      setErro(error instanceof ApiError ? error.message : "Falha ao apagar as demos do grupo.");
    } finally {
      setApagandoGrupo(false);
    }
  }

  if (erro && leads === null) {
    return <p className="text-sm text-critical">{erro}</p>;
  }

  if (leads === null) {
    return <SkeletonRows count={3} className="h-20 rounded-lg border border-line" />;
  }

  const demos = leads
    .filter((lead): lead is Lead & { demo: NonNullable<Lead["demo"]> } => Boolean(lead.demo))
    .sort((a, b) =>
      ordenacao === "recentes"
        ? b.demo.criadoEm.localeCompare(a.demo.criadoEm)
        : a.demo.criadoEm.localeCompare(b.demo.criadoEm),
    );

  if (demos.length === 0) {
    return (
      <p className="text-sm text-ink-muted">
        Nenhuma demo criada ainda. Abra a ficha de um lead e use{" "}
        <span className="text-foreground">Criar demo</span>.
      </p>
    );
  }

  // Autores com ao menos uma demo — só esses entram no filtro (sem opção
  // morta pra quem nunca criou nenhuma).
  const autoresComDemo = new Set(demos.map((lead) => lead.demo.criadoPor ?? SEM_AUTOR));
  const opcoesAutor = [...autoresComDemo].sort((a, b) => {
    if (a === SEM_AUTOR) return 1;
    if (b === SEM_AUTOR) return -1;
    return nomeUsuario(nomes, a).localeCompare(nomeUsuario(nomes, b));
  });

  const demosFiltradas = filtroAutor
    ? demos.filter((lead) => (lead.demo.criadoPor ?? SEM_AUTOR) === filtroAutor)
    : demos;

  const grupos = agrupar
    ? agruparPorBusca(demosFiltradas, buscas, (lead) => lead.buscaId)
    : [];

  function renderDemo(lead: Lead & { demo: NonNullable<Lead["demo"]> }) {
    const skin = getSkin(lead.demo.skinId);
    const ultimaAbertura = ultimaAberturaNaoInterna(lead);
    return (
      <li key={lead.placeId} className="card-lift rounded-lg border border-line bg-surface p-3">
        <div className="flex items-start justify-between gap-2">
          <Link href={`/leads/${lead.placeId}`} className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-foreground">{lead.nome}</p>
            <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
              <p className="truncate text-xs text-ink-secondary">{skin?.nome ?? lead.demo.skinId}</p>
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
              {lead.demo.criadoPor && (
                <span className="shrink-0 text-[10px] text-ink-muted">
                  por {nomeUsuario(nomes, lead.demo.criadoPor)}
                </span>
              )}
            </div>
          </Link>
          <div className="shrink-0 text-right text-[11px] text-ink-muted">
            <p>Criada {formatDateTime(lead.demo.criadoEm)}</p>
            <p>Editada {formatDateTime(lead.demo.atualizadoEm)}</p>
          </div>
        </div>

        <div className="mt-1.5">
          <SeloProntidao lead={lead} skin={skin} />
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
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-xs text-ink-muted">
          {filtroAutor ? `${demosFiltradas.length} de ${demos.length}` : demos.length} demo
          {demos.length === 1 ? "" : "s"} ativa{demos.length === 1 ? "" : "s"}
        </p>
        {opcoesAutor.length > 1 && (
          <select
            value={filtroAutor}
            onChange={(event) => setFiltroAutor(event.target.value)}
            className="rounded border border-line bg-surface-2 px-2 py-1.5 text-xs text-foreground outline-none focus:border-accent"
          >
            <option value="">Todos os autores</option>
            {opcoesAutor.map((autor) => (
              <option key={autor} value={autor}>
                {autor === SEM_AUTOR ? "Sem autor registrado" : nomeUsuario(nomes, autor)}
              </option>
            ))}
          </select>
        )}
        <select
          value={ordenacao}
          onChange={(event) => setOrdenacao(event.target.value as Ordenacao)}
          aria-label="Ordenar por data de criação"
          className="rounded border border-line bg-surface-2 px-2 py-1.5 text-xs text-foreground outline-none focus:border-accent"
        >
          {ORDENACOES.map(({ valor, label }) => (
            <option key={valor} value={valor}>
              {label}
            </option>
          ))}
        </select>
        <label className="ml-auto flex items-center gap-1.5 text-xs text-ink-secondary">
          <input
            type="checkbox"
            checked={agrupar}
            onChange={(event) => setAgrupar(event.target.checked)}
            className="h-3.5 w-3.5 accent-[var(--accent)]"
          />
          Agrupar por busca
        </label>
      </div>

      {erro && <p className="text-sm text-critical">{erro}</p>}
      {avisoGrupo && <p className="text-sm text-good">{avisoGrupo}</p>}

      {demosFiltradas.length === 0 ? (
        <p className="text-sm text-ink-muted">Nenhuma demo desse autor.</p>
      ) : agrupar ? (
        <div className="flex flex-col gap-3">
          {grupos.map((grupo) => {
            const fechado = fechados.has(grupo.chave);
            return (
              <section key={grupo.chave}>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => toggleColapsado(grupo.chave)}
                    aria-expanded={!fechado}
                    className="flex min-w-0 flex-1 items-center gap-2 rounded px-1 py-1.5 text-left hover:bg-surface"
                  >
                    <span className="text-xs text-ink-muted">{fechado ? "▸" : "▾"}</span>
                    <span
                      aria-hidden
                      className="h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: grupo.cor ?? "var(--ink-muted)" }}
                    />
                    <span className="truncate text-sm font-medium text-foreground">
                      {grupo.titulo}
                    </span>
                    <span className="shrink-0 text-xs text-ink-muted">{grupo.itens.length}</span>
                  </button>
                  {souAdmin && grupo.busca && grupo.itens.length > 0 && (
                    <button
                      type="button"
                      onClick={() =>
                        abrirApagarGrupo({
                          id: grupo.busca!.id,
                          titulo: grupo.titulo,
                          total: grupo.itens.length,
                        })
                      }
                      className="shrink-0 text-xs text-critical hover:underline"
                    >
                      Apagar todas
                    </button>
                  )}
                </div>
                {!fechado && (
                  <ul className="mt-1.5 flex flex-col gap-2">
                    {grupo.itens.map((lead) => renderDemo(lead))}
                  </ul>
                )}
              </section>
            );
          })}
        </div>
      ) : (
        <ul className="flex flex-col gap-2">{demosFiltradas.map((lead) => renderDemo(lead))}</ul>
      )}

      <ConfirmModal
        aberto={grupoParaApagar !== null}
        titulo="Apagar todas as demos do grupo"
        mensagem={
          grupoParaApagar
            ? `Isso apaga a demo (config e imagens) de ${grupoParaApagar.total} lead${grupoParaApagar.total === 1 ? "" : "s"} do grupo "${grupoParaApagar.titulo}". O lead, o status e o histórico de envio/visita continuam intactos. Para confirmar, digite "${FRASE_CONFIRMACAO_LOTE}" abaixo.`
            : ""
        }
        confirmarLabel={apagandoGrupo ? "Apagando…" : "Apagar todas"}
        confirmarDesabilitado={textoConfirmacaoLote !== FRASE_CONFIRMACAO_LOTE || apagandoGrupo}
        onConfirmar={confirmarApagarGrupo}
        onCancelar={fecharApagarGrupo}
        filhos={
          <input
            type="text"
            value={textoConfirmacaoLote}
            onChange={(event) => setTextoConfirmacaoLote(event.target.value)}
            placeholder={FRASE_CONFIRMACAO_LOTE}
            autoFocus
            className="w-full rounded border border-line bg-surface-2 px-2 py-1.5 text-sm text-foreground outline-none focus:border-accent"
          />
        }
      />
    </div>
  );
}
