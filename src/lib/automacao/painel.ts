import { capturasDisponiveis } from "@/lib/github/dispatch";
import { estadoVisivel, type LeadCapturas } from "@/lib/demos/capturas/estado";
import { getSkin, getTheme } from "@/lib/demos/registry";
import { lerPool, reconstruirPool, type PoolCandidatos } from "@/lib/fila/candidatos";
import { loadFilaConfig } from "@/lib/fila/config";
import type { AppDb } from "@/lib/firestore-like";
import { getLead } from "@/lib/leads/repo";
import { opcaoDoLead } from "@/lib/leads/selecao";
import type { Lead } from "@/lib/leads/types";

import { demoAutomaticaPendente } from "./balde";
import { loadAutomacaoConfig } from "./config";
import { execucaoAtiva } from "./disparo";
import { execucaoRef, ultimaRef, type EstadoUnidade, type ExecucaoAutomacao } from "./execucao";
import {
  proximaVarreduraAgendada,
  type ExpiracaoPainel,
  type ItemAprovacao,
  type PainelAutomacao,
  type ResumoExecucao,
} from "./painelTipos";
import { VARREDURA_MAX, motivoParaNaoVarrer } from "./varredura";

/**
 * Monta o painel "Automação" da /config numa chamada — config, estoque,
 * última execução, execução ativa e a fila de aprovação. É a mesma
 * resposta que dá a linha do cabeçalho fechado (nenhuma requisição existe
 * só para o resumo).
 *
 * **O custo.** Estoque e fila de aprovação precisam de `/leads` e
 * `/filaEnvios` inteiras. A varredura NÃO é feita aqui: ela já acontece no
 * pool da fila (`construirPool`, a cada `POOL_TTL_MS`, por `/proximo`), que
 * apura os baldes e os ids pendentes na mesma passada. Daqui sai `lerPool`
 * — que só varre se o pool venceu, e aí adianta a próxima varredura do
 * celular em vez de duplicá-la — mais uma regra: pool gerado ANTES da
 * última execução da automação é refeito, senão o painel mostraria a fila
 * de ontem logo depois de um "rodar agora".
 *
 * Os itens da fila são relidos POR ID e reconferidos: o pool OFERECE, a
 * tela confere (a regra de `/api/fila/diagnostico`). Quem já foi decidido
 * sai da lista na hora, mesmo com o pool de dez minutos atrás.
 */

/** A execução apontada por `ultima`, resumida para a tela. */
export function resumirExecucao(execucao: ExecucaoAutomacao): ResumoExecucao {
  const unidades: Partial<Record<EstadoUnidade, number>> = {};
  for (const unidade of execucao.unidades ?? []) {
    unidades[unidade.estado] = (unidades[unidade.estado] ?? 0) + 1;
  }
  const buscas = execucao.buscas ?? [];
  const falhas = execucao.falhas ?? [];
  return {
    id: execucao.id,
    estado: execucao.estado,
    disparo: execucao.disparo,
    ...(execucao.runUrl && { runUrl: execucao.runUrl }),
    iniciadaEm: execucao.iniciadaEm,
    ...(execucao.finalizadaEm && { finalizadaEm: execucao.finalizadaEm }),
    alvo: execucao.alvo,
    falta: execucao.falta,
    ...(execucao.estoqueAntes && { estoqueAntes: execucao.estoqueAntes }),
    ...(execucao.estoqueDepois && { estoqueDepois: execucao.estoqueDepois }),
    demosCriadas: (execucao.demosCriadas ?? []).length,
    buscas: buscas.length,
    leadsNovos: buscas.reduce((soma, b) => soma + (b.novos ?? 0), 0),
    requisicoesBusca: execucao.requisicoesBusca ?? 0,
    chamadasIA: execucao.chamadasIA ?? 0,
    falhas: falhas.length,
    ...(falhas[0] && { primeiraFalha: falhas[0].motivo }),
    unidades,
    ...(execucao.varredura && {
      varredura: {
        prazoHoras: execucao.varredura.prazoHoras,
        ...(execucao.varredura.naoRodou && { naoRodou: execucao.varredura.naoRodou }),
        apagadas: execucao.varredura.apagadas,
        puladas: execucao.varredura.puladas,
        restantes: execucao.varredura.restantes,
        storageFalhou: execucao.varredura.storageFalhou,
      },
    }),
    ...(execucao.motivo && { motivo: execucao.motivo }),
    ...(execucao.erro && { erro: execucao.erro }),
  };
}

async function lerUltima(db: AppDb): Promise<{ em?: string; execucao?: ExecucaoAutomacao }> {
  const ponteiro = (await ultimaRef(db).get()).data();
  const id = typeof ponteiro?.execucaoId === "string" ? ponteiro.execucaoId : "";
  const em = typeof ponteiro?.em === "string" ? ponteiro.em : undefined;
  if (!id) return { em };
  const snap = await execucaoRef(db, id).get();
  const data = snap.exists ? snap.data() : undefined;
  return { em, ...(data && { execucao: data as unknown as ExecucaoAutomacao }) };
}

/**
 * O pool para o painel: o do TTL, refeito se for anterior à última
 * execução ou se não tiver o retrato do estoque ou o da expiração (doc
 * gravado antes desses campos existirem).
 */
export async function poolDoPainel(
  db: AppDb,
  now: Date,
  ultimaEm: string | undefined,
): Promise<PoolCandidatos> {
  const corteLegado = (await loadAutomacaoConfig(db)).corteLegado;
  const pool = await lerPool(db, now, { corteLegado });
  const anterior = ultimaEm !== undefined && pool.geradoEm < ultimaEm;
  if (!pool.estoque || !pool.expiraveis || anterior) return reconstruirPool(db, now, { corteLegado });
  return pool;
}

/** O print do HERO: a crua de celular da âncora `hero`, ou a primeira que houver. */
export function heroDaCaptura(capturas: LeadCapturas | undefined): string | undefined {
  if (capturas?.estado !== "pronto") return undefined;
  const imagens = capturas.imagens ?? [];
  const hero =
    imagens.find((i) => i.ancora === "hero" && i.tela === "celular") ??
    imagens.find((i) => i.ancora === "hero") ??
    [...imagens].sort((a, b) => a.ordem - b.ordem)[0];
  return hero?.url;
}

export function itemDeAprovacao(lead: Lead, now: Date): ItemAprovacao | undefined {
  const demo = lead.demo;
  if (!demo || lead.leadDeTeste === true || !demoAutomaticaPendente(demo)) return undefined;
  const opcao = opcaoDoLead(lead);
  const skin = getSkin(demo.skinId);
  const tema = skin ? getTheme(skin, demo.themeId) : undefined;
  const visivel = estadoVisivel(lead.capturas, now.getTime());
  const heroUrl = heroDaCaptura(lead.capturas);
  return {
    leadId: lead.placeId,
    nome: opcao.nome,
    nicho: opcao.nicho,
    cidade: opcao.cidade,
    skinId: demo.skinId,
    skinNome: skin?.nome ?? demo.skinId,
    themeId: demo.themeId,
    presetNome: tema?.nome ?? demo.themeId,
    demoCriadaEm: demo.criadoEm,
    captura: {
      estado: visivel.estado,
      rotulo: visivel.rotulo,
      ...(visivel.detalhe && { detalhe: visivel.detalhe }),
      ...(heroUrl && { heroUrl }),
    },
  };
}

/**
 * A expiração para a tela: a lista do retrato do pool (o critério da
 * varredura, sem o prazo), o motivo de a próxima varredura não apagar nada
 * (a MESMA regra dela — fila pausada ou bloqueada) e a meta diária da fila,
 * para o aviso do estoque maior do que a fila manda.
 */
export function expiracaoDoPainel(
  pool: PoolCandidatos,
  filaConfig: { ativo: boolean; metaDiaria: number },
  now: Date,
  env: Record<string, string | undefined> = process.env,
): ExpiracaoPainel | null {
  if (!pool.expiraveis) return null;
  const naoRodaria = motivoParaNaoVarrer(filaConfig, env);
  return {
    criadas: pool.expiraveis,
    total: pool.expiraveisTotal ?? pool.expiraveis.length,
    geradoEm: pool.geradoEm,
    proximaVarreduraEm: new Date(proximaVarreduraAgendada(now.getTime())).toISOString(),
    ...(naoRodaria && { naoRodaria }),
    teto: VARREDURA_MAX,
    metaDiaria: filaConfig.metaDiaria,
  };
}

export async function montarPainelAutomacao(db: AppDb, now: Date = new Date()): Promise<PainelAutomacao> {
  const [config, ultima, ativa, filaConfig] = await Promise.all([
    loadAutomacaoConfig(db),
    lerUltima(db),
    execucaoAtiva(db, now),
    loadFilaConfig(db),
  ]);
  const pool = await poolDoPainel(db, now, ultima.em);

  const ids = pool.aprovacaoPendentes ?? [];
  const leads = await Promise.all(ids.map((id) => getLead(db, id)));
  const itens = leads
    .map((lead) => (lead ? itemDeAprovacao(lead, now) : undefined))
    .filter((item): item is ItemAprovacao => item !== undefined);
  // O total do retrato menos quem saiu na reconferência — nunca menor que
  // a própria lista.
  const total = Math.max((pool.aprovacaoPendentesTotal ?? ids.length) - (ids.length - itens.length), itens.length);

  return {
    config,
    expiracao: expiracaoDoPainel(pool, filaConfig, now),
    estoque: pool.estoque ? { ...pool.estoque, geradoEm: pool.geradoEm } : null,
    ultima: ultima.execucao ? resumirExecucao(ultima.execucao) : null,
    ativa,
    aprovacao: { itens, total },
    disparoDisponivel: capturasDisponiveis(),
  };
}
