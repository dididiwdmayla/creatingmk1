import { aiDisponivel, gerarSugestaoDemo } from "@/lib/ai";
import { QuotaExceededError, UserQuotaExceededError, type UsageCounts } from "@/lib/costs";
import { passaCriterioAprovacaoAutomatica } from "@/lib/demos/aprovacao";
import { patchCriacaoLote } from "@/lib/demos/lote";
import { montarDemoData } from "@/lib/demos/montar";
import { montarPatch } from "@/lib/demos/patch";
import { getSkin } from "@/lib/demos/registry";
import { proximaCombinacao } from "@/lib/demos/rodizio";
import { aplicarSugestaoTexto } from "@/lib/demos/sugestaoTexto";
import type { SkinDefinition } from "@/lib/demos/types";
import { validateLeadDemoInput } from "@/lib/demos/validate";
import { exemploDaSkin } from "@/lib/demos/variantes";
import { FILA_ENVIOS_COLLECTION } from "@/lib/fila/envios";
import type { AppDb } from "@/lib/firestore-like";
import { decidirAprovacaoDemo, getLead, saveDemo } from "@/lib/leads/repo";
import type { Lead } from "@/lib/leads/types";
import { SEARCH_MAX_PAGES } from "@/lib/places/client";
import { listBuscas } from "@/lib/buscas/repo";

import { AUTOMACAO_USER_ID } from "./autor";
import { executarBuscaAutomacao } from "./busca";
import type { AutomacaoConfig } from "./config";
import { motivoInelegivelAutomacao } from "./elegivel";
import {
  acertarOrcamento,
  reservarOrcamento,
  type BuscaFeita,
  type ExecucaoAutomacao,
  type ResultadoIA,
  type Unidade,
  type UnidadeBusca,
  type UnidadeDemo,
} from "./execucao";
import { escolherPar } from "./pares";

/**
 * As duas UNIDADES DE TRABALHO — cada uma cabe com folga numa chamada de
 * 300 s: uma demo (duas escritas no Firestore e, com IA, até duas chamadas
 * ao Gemini) ou uma busca (até três páginas de Text Search).
 */

/** Nível do texto por IA da automação — o default do diálogo de lote. */
export const NIVEL_IA_AUTOMACAO = "completo" as const;

/** Chamadas reservadas por demo: a primeira e o retry de resposta inválida. */
const IA_RESERVA = 2;

export interface ResultadoUnidade {
  estado: "feita" | "pulada" | "falhou";
  motivo?: string;
  /** Campos a gravar NA unidade (skin, IA, par…). */
  detalhes?: Partial<UnidadeDemo> | Partial<UnidadeBusca>;
  /** Lead que ganhou demo nesta unidade. */
  demoCriada?: string;
  busca?: BuscaFeita;
  parTentado?: string;
  /** Leads novos da busca, que viram unidades "demo" no mesmo plano. */
  novasUnidades?: Unidade[];
  semPares?: boolean;
  bloqueio?: string;
}

export interface ContextoUnidade {
  db: AppDb;
  execucao: ExecucaoAutomacao;
  config: AutomacaoConfig;
  caps: UsageCounts;
  now: Date;
}

function mensagem(erro: unknown): string {
  return erro instanceof Error ? erro.message : String(erro);
}

/* ── unidade DEMO ─────────────────────────────────────────────────────── */

/**
 * O texto por IA, pela MESMA sequência do diálogo de lote: sugestão →
 * `aplicarSugestaoTexto` sobre o efetivo → `montarPatch` contra a base →
 * PUT (aqui: validação + `saveDemo`). NUNCA obrigatório: qualquer falha
 * devolve a demo como estava (conteúdo de exemplo da skin) e o motivo.
 */
async function textoPorIA(
  ctx: ContextoUnidade,
  lead: Lead,
  skin: SkinDefinition,
): Promise<{ ia: ResultadoIA; motivo?: string; lead: Lead }> {
  if (!ctx.config.textoIA) return { ia: "desligada", lead };
  if (!aiDisponivel()) return { ia: "indisponivel", motivo: "GEMINI_API_KEY ausente", lead };
  // Mesmo corte do diálogo de lote: a skin de tema calibrado tem outro
  // modelo de conteúdo, e a geração em lote não a atende.
  if (skin.themeDefault.lancheria) return { ia: "sem_suporte", lead };
  const demo = lead.demo;
  if (!demo) return { ia: "falhou", motivo: "demo sumiu antes do texto", lead };

  const concedido = await reservarOrcamento(
    ctx.db,
    ctx.execucao.id,
    "chamadasIA",
    IA_RESERVA,
    ctx.config.tetoIANoite,
    IA_RESERVA,
  );
  if (concedido === 0) return { ia: "teto", motivo: "teto de chamadas de IA da noite", lead };

  let chamadas = 0;
  try {
    const sugestao = await gerarSugestaoDemo(ctx.db, lead, skin, ctx.caps, NIVEL_IA_AUTOMACAO, {
      userId: AUTOMACAO_USER_ID,
      isAdmin: false,
      contarChamada: () => {
        chamadas += 1;
      },
    });
    const exemplo = exemploDaSkin(skin, demo.themeId);
    const base = montarDemoData(exemplo, lead, undefined, skin.id);
    const efetivo = montarDemoData(exemplo, lead, demo.dados, skin.id);
    const dados = montarPatch(base, aplicarSugestaoTexto(sugestao, efetivo), skin);
    const entrada = validateLeadDemoInput({
      skinId: demo.skinId,
      themeId: demo.themeId,
      dados,
      ...(demo.tema && { tema: demo.tema }),
      ...(demo.idioma && { idioma: demo.idioma }),
    });
    const salvo = await saveDemo(ctx.db, lead.placeId, entrada, ctx.now, AUTOMACAO_USER_ID);
    return { ia: "ok", lead: salvo };
  } catch (erro) {
    return { ia: "falhou", motivo: mensagem(erro), lead };
  } finally {
    await acertarOrcamento(ctx.db, ctx.execucao.id, "chamadasIA", chamadas - concedido);
  }
}

/** Aprovação conforme o item 2: automática SÓ se ligada E o critério passa. */
async function decidirAprovacao(ctx: ContextoUnidade, lead: Lead, skin: SkinDefinition) {
  if (ctx.config.aprovacaoAutomatica && passaCriterioAprovacaoAutomatica(lead, skin)) {
    await decidirAprovacaoDemo(ctx.db, lead.placeId, "aprovada", AUTOMACAO_USER_ID, ctx.now);
    return "aprovada" as const;
  }
  return "pendente" as const;
}

export async function processarUnidadeDemo(
  ctx: ContextoUnidade,
  unidade: UnidadeDemo,
): Promise<ResultadoUnidade> {
  const lead = await getLead(ctx.db, unidade.leadId);
  if (!lead) return { estado: "pulada", motivo: "o lead não existe mais" };

  // IDEMPOTÊNCIA. Demo desta MESMA execução = a unidade morreu depois de
  // gravar e está sendo retomada: conta como criada, sem criar outra. Demo
  // de qualquer outra origem = pula.
  if (lead.demo) {
    if (lead.demo.execucaoAutomacao !== ctx.execucao.id) {
      return { estado: "pulada", motivo: "o lead já tem demo" };
    }
    const skin = getSkin(lead.demo.skinId);
    const aprovacao = skin ? await decidirAprovacao(ctx, lead, skin) : "pendente";
    return {
      estado: "feita",
      motivo: "retomada: a demo já estava gravada por esta execução",
      demoCriada: lead.placeId,
      detalhes: { skinId: lead.demo.skinId, themeId: lead.demo.themeId, aprovacao },
    };
  }

  // Reconfere com o doc FRESCO: entre o plano e esta unidade o operador
  // pode ter mexido no lead (contato, descarte, demo à mão).
  const docFila = await ctx.db.collection(FILA_ENVIOS_COLLECTION).doc(lead.placeId).get();
  const inelegivel = motivoInelegivelAutomacao(lead, docFila.exists, ctx.config.corteLegado);
  if (inelegivel) return { estado: "pulada", motivo: `lead inelegível (${inelegivel})` };

  const combinacao = await proximaCombinacao(ctx.db, lead.busca?.nicho ?? "", ctx.now);
  const skin = combinacao ? getSkin(combinacao.skinId) : undefined;
  if (!combinacao || !skin) return { estado: "pulada", motivo: "nicho sem skin" };

  // A criação é a do lote: `patchCriacaoLote`, modo "foto", SEM efeito no
  // patch — fica o efeito que o preset da skin já traz.
  const patch = patchCriacaoLote({
    skinId: combinacao.skinId,
    themeId: combinacao.themeId,
    imagensModo: "foto",
  });
  const entrada = validateLeadDemoInput({
    skinId: combinacao.skinId,
    themeId: combinacao.themeId,
    dados: patch.dados,
    ...(patch.tema && { tema: patch.tema }),
  });
  const criado = await saveDemo(ctx.db, lead.placeId, entrada, ctx.now, AUTOMACAO_USER_ID, {
    origem: "automacao",
    // Nasce PENDENTE — o portão da fila segura a demo desde a primeira
    // escrita, mesmo que a unidade morra antes de decidir a aprovação.
    aprovacao: "pendente",
    execucaoAutomacao: ctx.execucao.id,
  });

  const texto = await textoPorIA(ctx, criado, skin);
  const aprovacao = await decidirAprovacao(ctx, texto.lead, skin);
  return {
    estado: "feita",
    demoCriada: lead.placeId,
    ...(texto.motivo && { motivo: `texto por IA: ${texto.motivo}` }),
    detalhes: {
      skinId: combinacao.skinId,
      themeId: combinacao.themeId,
      ia: texto.ia,
      ...(texto.motivo && { iaMotivo: texto.motivo }),
      aprovacao,
    },
  };
}

/* ── unidade BUSCA ────────────────────────────────────────────────────── */

/** Quanto ainda falta, descontando as demos já feitas e as que estão na fila do plano. */
export function faltaNaExecucao(execucao: ExecucaoAutomacao, excetoUnidadeId?: string): number {
  const aCaminho = execucao.unidades.filter(
    (u) =>
      u.tipo === "demo" &&
      u.id !== excetoUnidadeId &&
      (u.estado === "pendente" || u.estado === "rodando"),
  ).length;
  return execucao.falta - execucao.demosCriadas.length - aCaminho;
}

export async function processarUnidadeBusca(
  ctx: ContextoUnidade,
  unidade: UnidadeBusca,
  novoId: () => string,
): Promise<ResultadoUnidade> {
  const restante = faltaNaExecucao(ctx.execucao, unidade.id);
  if (restante <= 0) return { estado: "pulada", motivo: "nada mais falta" };

  const escolha = await escolherPar(
    ctx.db,
    await listBuscas(ctx.db),
    ctx.config,
    ctx.now,
    ctx.execucao.paresTentados,
  );
  const par = escolha.par;
  if (!par) {
    const { saturados, recentes } = escolha.descartados;
    const motivo = `nenhum par disponível (${saturados.length} saturado(s), ${recentes.length} buscado(s) nas últimas ${ctx.config.intervaloParHoras}h)`;
    return { estado: "pulada", motivo, semPares: true, bloqueio: motivo };
  }

  const concedido = await reservarOrcamento(
    ctx.db,
    ctx.execucao.id,
    "requisicoesBusca",
    SEARCH_MAX_PAGES,
    ctx.config.tetoBuscasNoite,
  );
  if (concedido === 0) {
    const motivo = "teto de requisições de busca da noite";
    return { estado: "pulada", motivo, bloqueio: motivo };
  }

  let paginas = concedido;
  try {
    const resultado = await executarBuscaAutomacao(ctx.db, par, {
      quantidade: restante,
      maxPaginas: concedido,
      caps: ctx.caps,
      now: ctx.now,
    });
    paginas = resultado.paginas;
    const novasUnidades: UnidadeDemo[] = resultado.leadsNovos.slice(0, restante).map((lead) => ({
      id: novoId(),
      tipo: "demo",
      leadId: lead.placeId,
      fonte: "busca",
      estado: "pendente",
      tentativas: 0,
    }));
    return {
      estado: "feita",
      ...(resultado.aviso && { motivo: resultado.aviso }),
      parTentado: par.chave,
      busca: {
        parChave: par.chave,
        nicho: par.nicho,
        regiao: par.regiao,
        buscaId: resultado.buscaId,
        paginas: resultado.paginas,
        novos: resultado.novos,
      },
      detalhes: {
        parChave: par.chave,
        nicho: par.nicho,
        regiao: par.regiao,
        buscaId: resultado.buscaId,
        paginas: resultado.paginas,
        novos: resultado.novos,
      },
      novasUnidades,
    };
  } catch (erro) {
    // Sem saber quantas páginas saíram, o acerto é conservador: a reserva
    // inteira fica cobrada (o Google cobra a página que respondeu erro).
    // Teto GLOBAL (ou a cota individual da automação) estourado: nenhuma
    // outra busca desta noite passaria — para de enfileirar busca.
    const cota = erro instanceof QuotaExceededError || erro instanceof UserQuotaExceededError;
    return {
      estado: "falhou",
      motivo: mensagem(erro),
      ...(cota && { semPares: true, bloqueio: mensagem(erro) }),
      parTentado: par.chave,
      detalhes: { parChave: par.chave, nicho: par.nicho, regiao: par.regiao },
    };
  } finally {
    await acertarOrcamento(ctx.db, ctx.execucao.id, "requisicoesBusca", paginas - concedido);
  }
}
