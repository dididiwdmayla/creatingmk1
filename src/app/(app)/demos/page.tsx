"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { Button } from "@/components/Button";
import { ConfirmModal } from "@/components/ConfirmModal";
import { NovaDemoAvulsaDialog } from "@/components/demos/NovaDemoAvulsaDialog";
import { SeloProntidao } from "@/components/SeloProntidao";
import { SkeletonRows } from "@/components/Skeleton";
import { ApiError, api } from "@/lib/api-client";
import { agruparPorBusca } from "@/lib/buscas/agrupar";
import type { Busca } from "@/lib/buscas/types";
import { nomeUsuario, type NomesUsuarios } from "@/lib/contato-selo";
import { montarDemoDataAvulsa, nomeDaAvulsa } from "@/lib/demos/avulsas/identidade";
import { idiomaEfetivoAvulsa } from "@/lib/demos/avulsas/idioma";
import type { DemoAvulsa } from "@/lib/demos/avulsas/types";
import { caminhoDemo, demoUrlComToken, envioVigente } from "@/lib/demos/envio";
import {
  pendenciasDaDemo,
  pendenciasProntidao,
  type PendenciaProntidao,
} from "@/lib/demos/prontidao";
import { getSkin } from "@/lib/demos/registry";
import type { LeadDemo, SkinDefinition } from "@/lib/demos/types";
import { formatDateTime, formatTempoRelativo } from "@/lib/format";
import { ultimaAberturaNaoInterna } from "@/lib/leads/hoje";
import type { Lead } from "@/lib/leads/types";

const SEM_AUTOR = "__sem_autor__";

type Ordenacao = "recentes" | "antigas";

const ORDENACOES: Array<{ valor: Ordenacao; label: string }> = [
  { valor: "recentes", label: "Mais recentes primeiro" },
  { valor: "antigas", label: "Mais antigas primeiro" },
];

/** Filtro por ORIGEM da demo: de um lead do funil, ou avulsa. */
type Origem = "todas" | "lead" | "avulsa";

const ORIGENS: Array<{ valor: Origem; label: string }> = [
  { valor: "todas", label: "Todas as origens" },
  { valor: "lead", label: "Só de lead" },
  { valor: "avulsa", label: "Só avulsas" },
];

/** Texto exato que precisa ser digitado para habilitar "Apagar todas do grupo". */
const FRASE_CONFIRMACAO_LOTE = "apagar todos";

/** Chave do pseudo-grupo das avulsas quando "Agrupar por busca" está ligado. */
const GRUPO_AVULSAS = "__avulsas__";

/**
 * Uma linha da listagem, seja qual for a origem. As duas famílias de demo
 * guardam o mesmo `LeadDemo`, então tudo o que a listagem mostra (skin,
 * datas, autor, prontidão, abertura, link) sai daqui igual — `origem`
 * decide só o selo, os caminhos e o que o botão de excluir faz.
 */
interface ItemDemo {
  id: string;
  origem: "lead" | "avulsa";
  nome: string;
  demo: LeadDemo;
  skin: SkinDefinition | undefined;
  /** Buscas de origem — só a demo de lead tem; é o que agrupa a listagem. */
  buscaId?: string[];
  ultimaAbertura?: string;
  pendencias: PendenciaProntidao[] | null;
  /** Ficha do lead; na avulsa, o editor (é onde ela existe por inteiro). */
  href: string;
  hrefEditar: string;
  hrefPublico: string;
}

function itemDeLead(lead: Lead & { demo: LeadDemo }): ItemDemo {
  const skin = getSkin(lead.demo.skinId);
  return {
    id: lead.placeId,
    origem: "lead",
    nome: lead.nome,
    demo: lead.demo,
    skin,
    buscaId: lead.buscaId,
    ultimaAbertura: ultimaAberturaNaoInterna(lead),
    pendencias: skin ? pendenciasProntidao(lead, skin) : null,
    href: `/leads/${lead.placeId}`,
    hrefEditar: `/leads/${lead.placeId}/demo/editar`,
    hrefPublico: caminhoDemo(lead.placeId),
  };
}

function itemDeAvulsa(avulsa: DemoAvulsa): ItemDemo {
  const skin = getSkin(avulsa.demo.skinId);
  const editar = `/demos-avulsas/${avulsa.id}/editar`;
  return {
    id: avulsa.id,
    origem: "avulsa",
    nome: nomeDaAvulsa(avulsa),
    demo: avulsa.demo,
    skin,
    ultimaAbertura: (avulsa.demoVisitas ?? [])
      .filter((visita) => !visita.interna)
      .map((visita) => visita.em)
      .sort()
      .at(-1),
    pendencias: skin
      ? pendenciasDaDemo(
          montarDemoDataAvulsa(skin.demoDataExemplo, avulsa.demo.dados, skin.id),
          avulsa.demo.dados,
          idiomaEfetivoAvulsa(avulsa),
          skin,
        )
      : null,
    // A avulsa não tem ficha: o clique no nome leva pro editor.
    href: editar,
    hrefEditar: editar,
    hrefPublico: caminhoDemo(avulsa.id, true),
  };
}

/**
 * Todas as demos ativas — as de LEAD (leads com `demo` salva) e as
 * AVULSAS (coleção própria `/demosAvulsas`, sem lead associado).
 * Reaproveita GET /api/leads (sem filtros) + GET /api/demos-avulsas e
 * unifica client-side em `ItemDemo`; mesma escala de "centenas" do resto
 * do app.
 *
 * **Origem** (select "Todas / Só de lead / Só avulsas") separa as duas
 * famílias, e cada linha avulsa leva um selo visível. As duas coisas
 * existem porque uma avulsa não pertence a grupo de busca nenhum e não
 * conta em métrica nenhuma do funil: confundi-la com uma demo de
 * prospecção seria ler o funil errado.
 *
 * Agrupamento por busca (nome/cor/colapso — mesmo padrão de `/leads`) e
 * filtro por autor combinam com a ordenação por `LeadDemo.criadoEm`. Com o
 * agrupamento ligado, as avulsas caem num grupo PRÓPRIO ("Demos avulsas"),
 * nunca no pseudo-grupo "Sem busca" (que é o das demos de lead órfãs).
 *
 * **"Apagar todas do grupo"** (só admin, recusado no SERVIDOR) segue
 * valendo apenas para grupos de BUSCA de verdade — o grupo das avulsas não
 * o oferece, como o "Sem busca" nunca ofereceu.
 */
export default function DemosPage() {
  const router = useRouter();
  const [leads, setLeads] = useState<Lead[] | null>(null);
  const [avulsas, setAvulsas] = useState<DemoAvulsa[]>([]);
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
  const [origem, setOrigem] = useState<Origem>("todas");
  const [ordenacao, setOrdenacao] = useState<Ordenacao>("recentes");
  const [criandoAvulsa, setCriandoAvulsa] = useState(false);

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
      .listDemosAvulsas()
      .then(({ avulsas: data }) => {
        if (!ignore) setAvulsas(data);
      })
      .catch(() => {
        // As demos de lead não dependem disto — a lista degrada sem avulsas.
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

  async function copiarLink(item: ItemDemo) {
    try {
      // Canal "link" — independente do token que possa estar numa mensagem
      // de WhatsApp já montada pra esta mesma demo (ver EnvioDemo.canal).
      const token = envioVigente(item.demo, "link")?.token;
      const url = demoUrlComToken(window.location.origin, item.id, token, item.origem === "avulsa");
      await navigator.clipboard.writeText(url);
      setCopiado(item.id);
      setTimeout(() => setCopiado((atual) => (atual === item.id ? null : atual)), 2000);
    } catch {
      setErro("Não deu pra copiar — copie da barra de endereço da demo.");
    }
  }

  async function excluir(item: ItemDemo) {
    if (confirmaExcluir !== item.id) {
      setConfirmaExcluir(item.id);
      return;
    }
    setExcluindo(item.id);
    try {
      if (item.origem === "avulsa") {
        // Na avulsa a demo É o registro: apagar tira o doc inteiro.
        await api.deleteDemoAvulsa(item.id);
        setAvulsas((atual) => atual.filter((a) => a.id !== item.id));
      } else {
        // Na demo de lead some só o campo `demo` — o prospect fica.
        await api.deleteLeadDemo(item.id);
        setLeads((atual) => atual?.filter((lead) => lead.placeId !== item.id) ?? atual);
      }
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

  const dialogo = criandoAvulsa ? (
    <NovaDemoAvulsaDialog
      onFechar={() => setCriandoAvulsa(false)}
      onCriada={(avulsa) => {
        setAvulsas((atual) => [avulsa, ...atual]);
        setCriandoAvulsa(false);
        router.push(`/demos-avulsas/${avulsa.id}/editar`);
      }}
    />
  ) : null;

  const botaoNova = (
    <Button onClick={() => setCriandoAvulsa(true)} className="!px-2.5 !py-1.5 text-xs">
      + Demo avulsa
    </Button>
  );

  if (erro && leads === null) {
    return <p className="text-sm text-critical">{erro}</p>;
  }

  if (leads === null) {
    return <SkeletonRows count={3} className="h-20 rounded-lg border border-line" />;
  }

  const itensDeLead = leads
    .filter((lead): lead is Lead & { demo: LeadDemo } => Boolean(lead.demo))
    .map(itemDeLead);
  const itensAvulsos = avulsas.map(itemDeAvulsa);

  const demos = [...itensDeLead, ...itensAvulsos].sort((a, b) =>
    ordenacao === "recentes"
      ? b.demo.criadoEm.localeCompare(a.demo.criadoEm)
      : a.demo.criadoEm.localeCompare(b.demo.criadoEm),
  );

  if (demos.length === 0) {
    return (
      <div className="flex flex-col items-start gap-3">
        <p className="text-sm text-ink-muted">
          Nenhuma demo criada ainda. Abra a ficha de um lead e use{" "}
          <span className="text-foreground">Criar demo</span>, ou crie uma demo avulsa (sem lead).
        </p>
        {botaoNova}
        {dialogo}
      </div>
    );
  }

  // Autores com ao menos uma demo — só esses entram no filtro (sem opção
  // morta pra quem nunca criou nenhuma).
  const autoresComDemo = new Set(demos.map((item) => item.demo.criadoPor ?? SEM_AUTOR));
  const opcoesAutor = [...autoresComDemo].sort((a, b) => {
    if (a === SEM_AUTOR) return 1;
    if (b === SEM_AUTOR) return -1;
    return nomeUsuario(nomes, a).localeCompare(nomeUsuario(nomes, b));
  });

  const demosFiltradas = demos
    .filter((item) => origem === "todas" || item.origem === origem)
    .filter((item) => !filtroAutor || (item.demo.criadoPor ?? SEM_AUTOR) === filtroAutor);

  const temFiltro = Boolean(filtroAutor) || origem !== "todas";

  // As avulsas não pertencem a busca nenhuma: vão pro grupo próprio, nunca
  // pro "Sem busca" (que é o das demos de LEAD sem grupo de origem).
  const grupos = agrupar
    ? [
        ...agruparPorBusca(
          demosFiltradas.filter((item) => item.origem === "lead"),
          buscas,
          (item) => item.buscaId,
        ),
        ...(demosFiltradas.some((item) => item.origem === "avulsa")
          ? [
              {
                chave: GRUPO_AVULSAS,
                titulo: "Demos avulsas",
                cor: "var(--accent)",
                busca: undefined,
                itens: demosFiltradas.filter((item) => item.origem === "avulsa"),
              },
            ]
          : []),
      ]
    : [];

  function renderDemo(item: ItemDemo) {
    return (
      <li key={item.id} className="card-lift rounded-lg border border-line bg-surface p-3">
        <div className="flex items-start justify-between gap-2">
          <Link href={item.href} className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <p className="truncate text-sm font-medium text-foreground">{item.nome}</p>
              {item.origem === "avulsa" && (
                <span
                  title="Demo sem lead associado — fora de toda contagem do funil"
                  className="shrink-0 rounded-full border border-accent/40 bg-accent/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-accent"
                >
                  avulsa
                </span>
              )}
            </div>
            <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
              <p className="truncate text-xs text-ink-secondary">
                {item.skin?.nome ?? item.demo.skinId}
              </p>
              {item.ultimaAbertura ? (
                <span
                  title={formatDateTime(item.ultimaAbertura)}
                  className="shrink-0 rounded-full bg-good/15 px-1.5 py-0.5 text-[10px] font-semibold text-good"
                >
                  aberta {agora > 0 ? formatTempoRelativo(item.ultimaAbertura, agora) : ""}
                </span>
              ) : (
                <span className="shrink-0 rounded-full bg-surface-2 px-1.5 py-0.5 text-[10px] font-semibold text-ink-muted">
                  não aberta
                </span>
              )}
              {item.demo.criadoPor && (
                <span className="shrink-0 text-[10px] text-ink-muted">
                  por {nomeUsuario(nomes, item.demo.criadoPor)}
                </span>
              )}
            </div>
          </Link>
          <div className="shrink-0 text-right text-[11px] text-ink-muted">
            <p>Criada {formatDateTime(item.demo.criadoEm)}</p>
            <p>Editada {formatDateTime(item.demo.atualizadoEm)}</p>
          </div>
        </div>

        <div className="mt-1.5">
          <SeloProntidao pendencias={item.pendencias} />
        </div>

        <div className="mt-2.5 flex flex-wrap items-center gap-2">
          <a
            href={item.hrefPublico}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-accent hover:underline"
          >
            Abrir demo ↗
          </a>
          <button
            type="button"
            onClick={() => copiarLink(item)}
            className="text-xs text-ink-muted hover:text-foreground"
          >
            {copiado === item.id ? "Copiado!" : "Copiar link"}
          </button>
          <Link href={item.hrefEditar} className="text-xs text-ink-muted hover:text-foreground">
            Editar
          </Link>
          <span className="ml-auto" />
          {confirmaExcluir === item.id && (
            <span className="text-[11px] text-critical">
              {item.origem === "avulsa"
                ? "Apaga a demo avulsa inteira e as imagens."
                : "Apaga registro e imagens."}
            </span>
          )}
          <Button
            variant="danger"
            onClick={() => excluir(item)}
            loading={excluindo === item.id}
            className="!px-2 !py-1 text-xs"
          >
            {confirmaExcluir === item.id ? "Confirmar exclusão" : "Excluir"}
          </Button>
          {confirmaExcluir === item.id && excluindo !== item.id && (
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
          {temFiltro ? `${demosFiltradas.length} de ${demos.length}` : demos.length} demo
          {demos.length === 1 ? "" : "s"} ativa{demos.length === 1 ? "" : "s"}
          {itensAvulsos.length > 0 &&
            ` · ${itensAvulsos.length} avulsa${itensAvulsos.length === 1 ? "" : "s"}`}
        </p>
        {itensAvulsos.length > 0 && (
          <select
            value={origem}
            onChange={(event) => setOrigem(event.target.value as Origem)}
            aria-label="Filtrar por origem da demo"
            className="rounded border border-line bg-surface-2 px-2 py-1.5 text-xs text-foreground outline-none focus:border-accent"
          >
            {ORIGENS.map(({ valor, label }) => (
              <option key={valor} value={valor}>
                {label}
              </option>
            ))}
          </select>
        )}
        {opcoesAutor.length > 1 && (
          <select
            value={filtroAutor}
            onChange={(event) => setFiltroAutor(event.target.value)}
            aria-label="Filtrar por autor"
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
        {botaoNova}
      </div>

      {erro && <p className="text-sm text-critical">{erro}</p>}
      {avisoGrupo && <p className="text-sm text-good">{avisoGrupo}</p>}

      {demosFiltradas.length === 0 ? (
        <p className="text-sm text-ink-muted">Nenhuma demo com esses filtros.</p>
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
                    {grupo.itens.map((item) => renderDemo(item))}
                  </ul>
                )}
              </section>
            );
          })}
        </div>
      ) : (
        <ul className="flex flex-col gap-2">{demosFiltradas.map((item) => renderDemo(item))}</ul>
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

      {dialogo}
    </div>
  );
}
