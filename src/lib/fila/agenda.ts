import { loadAutomacaoConfig } from "@/lib/automacao/config";
import { motivoNaoExpira, vencimentoDaDemo } from "@/lib/automacao/expiracao";
import { proximaVarreduraAgendada } from "@/lib/automacao/painelTipos";
import { listBuscas } from "@/lib/buscas/repo";
import { loadConfig } from "@/lib/config";
import type { AppDb } from "@/lib/firestore-like";
import { listConjuntos, patchAvancoRotacao } from "@/lib/frases/repo";
import { cidadeDoEndereco } from "@/lib/leads/cidade";
import type { JanelasContatoConfig } from "@/lib/leads/janelaContato";
import { getLead } from "@/lib/leads/repo";
import type { Lead } from "@/lib/leads/types";

import { lerPoolBruto, lerPoolSemGravar, type CandidatoFila, type PoolCandidatos } from "./candidatos";
import { loadFilaConfig, type FilaConfig } from "./config";
import {
  contadorComEnvio,
  contadorDoDoc,
  diaOperacionalKey,
  lerContadorFilaCompleto,
  proximaViradaDiaOperacional,
  type FilaContadorDoc,
} from "./contadores";
import { printParaEntrega, vereditoDaMensagem } from "./entrega";
import { TENTATIVAS_MAX, leadDisponivel, lerEnvioDoLead, type FilaEnvioDoc } from "./envios";
import type {
  AgendaFila,
  BarradoAgenda,
  LinhaAgenda,
  MotivoHorarioAgenda,
  VencidoAgenda,
} from "./estado";
import { montarMensagemParaLead, type FontesDaMensagem } from "./mensagem";
import { motivoDeSaude } from "./saude";
import { nichoPermitido, proximaSaida, type MotivoSemTarefa } from "./selecao";

/**
 * A AGENDA DA FILA — os próximos leads na ordem em que vão sair, com o
 * horário a partir do qual cada um sai, visível antes de a janela abrir e
 * com a fila pausada.
 *
 * **É uma SIMULAÇÃO, e não uma segunda fila.** Roda as MESMAS funções que
 * `/api/fila/proximo` usa, com um relógio que anda: `proximaSaida` (ritmo →
 * nicho → janela, lib/fila/selecao.ts) diz quem sai e quando; para cada
 * candidato daquela ordem, a reserva é `leadDisponivel` (a regra da
 * transação de `reservarLead`), o doc fresco passa por `printParaEntrega`, a
 * mensagem é montada por `montarMensagemParaLead` e conferida por
 * `vereditoDaMensagem` — e o primeiro que passa ganha o horário. Depois, os
 * efeitos de um envio CONFIRMADO, com as funções de `/confirmar`:
 * `contadorComEnvio` no contador do dia operacional daquele instante e o
 * giro da rotação de frases (`patchAvancoRotacao` — a frase muda a cada
 * envio, e é ela que decide se sobra marcador). E repete. Se a agenda e a
 * fila pudessem discordar, a agenda não serviria para nada; há teste que
 * avança o relógio até cada horário previsto e chama o `/proximo` de verdade.
 *
 * **Nunca reserva, nunca grava, nunca chama API paga.** Tudo é em memória:
 * o contador, a rotação e o pool simulados são cópias.
 *
 * Três saídas além da sequência:
 *
 * - **barrados** — chegam à vez e a guarda da mensagem os barra (marcador
 *   sem resolver, sem telefone). Não ocupam vaga, como na fila real, e são
 *   reavaliados a cada envio simulado: a rotação pode trocar a frase por uma
 *   que serve, e aí eles saem.
 * - **vencidos** — chegariam à vez depois de a varredura das demos
 *   automáticas apagar a demo (`motivoNaoExpira`, a função da varredura,
 *   em cada varredura agendada até o horário). A fila real não os manda:
 *   saem da sequência e os seguintes sobem.
 * - **fora** — elegíveis que sobraram: além do alvo, ou sem horário até o
 *   horizonte.
 *
 * O HORIZONTE não é fixo (`limitesDaAgenda`): a simulação anda até o alvo
 * ou até o fim do dia operacional da primeira saída — nunca antes do fim de
 * amanhã, nunca depois do sétimo dia. Sábado à tarde, com tudo abrindo
 * segunda às 9h, a agenda vai até o fim de segunda.
 */

/** Quantos leads a agenda procura quando o estoque alvo da automação não diz. */
export const AGENDA_ALVO_PADRAO = 15;

/** Teto da agenda, qualquer que seja o alvo — cada linha custa leituras por id. */
export const AGENDA_ALVO_MAX = 50;

/**
 * Teto do HORIZONTE, em viradas do dia operacional: hoje e os seis dias
 * seguintes. Sete viradas nunca passam de 7×24h, e o último dia nunca tem o
 * mesmo dia da semana de hoje — "até o fim de sexta" não é ambíguo.
 */
export const AGENDA_DIAS_MAX = 7;

/** O que a simulação precisa, já lido. */
export interface EntradaAgenda {
  now: Date;
  /**
   * Até onde o relógio anda (inclusive) — ver `limitesDaAgenda`: `minimo`
   * é o fim do PRÓXIMO dia operacional, `teto` o fim do sétimo. A agenda
   * vai até o fim do dia da PRIMEIRA saída (nunca antes de `minimo`, nunca
   * depois de `teto`); sem saída nenhuma, até o teto.
   */
  horizonte: { minimo: Date; teto: Date };
  /** Quantos leads procurar. */
  alvo: number;
  config: FilaConfig;
  janelas: JanelasContatoConfig;
  corteLegado: string;
  /** O doc de `filaContadores` do dia operacional de `now`. */
  contadorHoje: FilaContadorDoc;
  pool: CandidatoFila[];
  fontes: FontesDaMensagem;
  /**
   * A expiração das demos automáticas: se a varredura roda (a automação
   * ligada) e o prazo. A agenda supõe a fila ATIVA — então a regra de não
   * varrer com a fila parada (`motivoParaNaoVarrer`) não entra: no cenário
   * que a agenda descreve, a fila está mandando.
   */
  expiracao: { varreduraRoda: boolean; prazoHoras: number };
}

export interface ResultadoAgenda {
  linhas: LinhaAgenda[];
  barrados: BarradoAgenda[];
  vencidos: VencidoAgenda[];
  fora: number;
  parouPor: "alvo" | "horizonte";
  /** Até onde a agenda foi, de fato (ver `EntradaAgenda.horizonte`). */
  horizonte: Date;
}

interface FichaAgenda {
  lead: Lead | undefined;
  envio: FilaEnvioDoc | undefined;
}

/**
 * A primeira varredura agendada, até `ate`, que apagaria a demo deste lead —
 * `motivoNaoExpira` no instante de cada varredura (`proximaVarreduraAgendada`,
 * a agenda do workflow), com os mesmos sinais que o pool passa (doc na fila;
 * ciclos não são lidos, e ciclo sem doc principal não existe por construção).
 */
function varreduraQueApaga(
  lead: Lead,
  envio: FilaEnvioDoc | undefined,
  ate: Date,
  entrada: EntradaAgenda,
): { venceEm: string; varreduraEm: string } | undefined {
  if (!entrada.expiracao.varreduraRoda || lead.demo?.origem !== "automacao") return undefined;
  const { prazoHoras } = entrada.expiracao;
  for (
    let varredura = proximaVarreduraAgendada(entrada.now.getTime());
    varredura <= ate.getTime();
    varredura = proximaVarreduraAgendada(varredura)
  ) {
    if (motivoNaoExpira(lead, { temDocFila: envio !== undefined }, { now: new Date(varredura), prazoHoras }) === undefined) {
      return {
        venceEm: new Date(vencimentoDaDemo(lead.demo, prazoHoras) as number).toISOString(),
        varreduraEm: new Date(varredura).toISOString(),
      };
    }
  }
  return undefined;
}

/** O motivo do horário da linha, a partir do último portão que segurou a fila. */
function motivoDaLinha(segurou: MotivoSemTarefa | undefined, jaSaiuAlguem: boolean): MotivoHorarioAgenda {
  switch (segurou) {
    case "fora_de_janela":
      return "janela";
    case "intervalo":
      return "intervalo";
    case "teto_hora":
      return "teto_hora";
    case "meta_atingida":
      return "meta";
    default:
      return jaSaiuAlguem ? "em_seguida" : "agora";
  }
}

/**
 * A SIMULAÇÃO. Só lê por id (o lead e o doc da fila de quem chega à vez) —
 * tudo o que decide é puro e é o mesmo código da fila.
 */
export async function simularAgenda(db: AppDb, entrada: EntradaAgenda): Promise<ResultadoAgenda> {
  // A agenda é a da fila ATIVA: pausada, ela diz o que sai quando voltar
  // (e a tela avisa que nada sai enquanto isso).
  const config: FilaConfig = { ...entrada.config, ativo: true };
  const contadores: Record<string, FilaContadorDoc> = {
    [diaOperacionalKey(entrada.now, config.inicioDiaOperacionalHora)]: entrada.contadorHoje,
  };
  // Cópia: a rotação gira em memória a cada envio simulado.
  const conjuntos = entrada.fontes.conjuntos.map((conjunto) => ({ ...conjunto }));
  const fontes: FontesDaMensagem = { ...entrada.fontes, conjuntos };

  const fichas = new Map<string, Promise<FichaAgenda>>();
  const ficha = (id: string): Promise<FichaAgenda> => {
    let lida = fichas.get(id);
    if (!lida) {
      lida = Promise.all([getLead(db, id), lerEnvioDoLead(db, id)]).then(([lead, envio]) => ({ lead, envio }));
      fichas.set(id, lida);
    }
    return lida;
  };

  const doPool = new Map(entrada.pool.map((candidato) => [candidato.id, candidato]));
  let restantes = [...entrada.pool];
  const remover = (id: string) => {
    restantes = restantes.filter((candidato) => candidato.id !== id);
  };
  /** Barrados COM A ROTAÇÃO DE AGORA — saem da busca até o próximo envio girar a frase. */
  const barradosAgora = new Set<string>();
  /** O último veredito de cada barrado que ainda não saiu. */
  const barrados = new Map<string, BarradoAgenda>();
  const vencidos: VencidoAgenda[] = [];
  const linhas: LinhaAgenda[] = [];

  let cursor = entrada.now;
  /**
   * Até a primeira saída, o teto — no fim de semana a primeira saída é
   * segunda de manhã, e um horizonte fixo em "amanhã" deixava a agenda
   * vazia. Depois dela, o fim do dia operacional dela (ver `limiteDepoisDe`).
   */
  let limite = entrada.horizonte.teto;
  /** O portão que trouxe o relógio até `cursor`, quando quem chegou lá não saiu. */
  let segurouNoCursor: MotivoSemTarefa | undefined;
  /** A meta segurou a fila em algum ponto desde o último envio simulado. */
  let metaDesdeOUltimo = false;

  while (linhas.length < entrada.alvo) {
    const saida = proximaSaida(
      {
        config,
        janelas: entrada.janelas,
        pool: restantes.filter((candidato) => !barradosAgora.has(candidato.id)),
        contadores,
      },
      cursor,
      { ate: limite },
    );
    if (!saida.em) break;
    const em = saida.em;
    const segurou = saida.segurou ?? (em.getTime() === cursor.getTime() ? segurouNoCursor : undefined);
    metaDesdeOUltimo ||= saida.motivoEmDesde === "meta_atingida";

    let saiu = false;
    for (const candidato of saida.fila) {
      const { lead, envio } = await ficha(candidato.id);
      // A RESERVA (`leadDisponivel`, a regra da transação de `reservarLead`):
      // claim viva agora vira revisão quando vence — o lead não sai mais por
      // conta própria. E o doc fresco que já não serve (o pool é cache).
      // Os dois são permanentes daqui para a frente: o lead sai da busca.
      if (!leadDisponivel(envio, em, TENTATIVAS_MAX) || !lead || !printParaEntrega(lead, entrada.corteLegado)) {
        remover(candidato.id);
        continue;
      }
      // A demo que a varredura apaga antes da vez dele: na fila real, o lead
      // relido não tem mais demo e não sai.
      const vence = varreduraQueApaga(lead, envio, em, entrada);
      if (vence) {
        vencidos.push({ leadId: candidato.id, nome: lead.nome, ...vence, sairiaEm: em.toISOString() });
        barrados.delete(candidato.id);
        remover(candidato.id);
        continue;
      }
      const mensagem = await montarMensagemParaLead(db, lead, fontes);
      const veredito = vereditoDaMensagem(mensagem);
      if ("barreira" in veredito) {
        barradosAgora.add(candidato.id);
        barrados.set(candidato.id, {
          leadId: candidato.id,
          nome: lead.nome,
          motivo: veredito.barreira,
          marcador: veredito.barreira === "marcador" ? veredito.marcador : "",
        });
        continue;
      }

      linhas.push({
        leadId: candidato.id,
        nome: lead.nome,
        em: em.toISOString(),
        motivo: motivoDaLinha(segurou, linhas.length > 0),
        depoisDaMeta: metaDesdeOUltimo,
        // O fuso e o selo que a DECISÃO usou — os do pool, não os do doc fresco.
        offsetLead: doPool.get(candidato.id)?.offset ?? 0,
        cidade: (lead.endereco && cidadeDoEndereco(lead.endereco).cidade) || "",
        nivel: candidato.nivel,
        manual: doPool.get(candidato.id)?.manual === true,
      });
      if (linhas.length === 1) limite = limiteDepoisDe(em, entrada.horizonte, config.inicioDiaOperacionalHora);
      barrados.delete(candidato.id);
      remover(candidato.id);

      // O ENVIO CONFIRMADO, em memória — as funções de `/confirmar`.
      const chave = diaOperacionalKey(em, config.inicioDiaOperacionalHora);
      contadores[chave] = contadorComEnvio(
        contadores[chave] as unknown as Record<string, unknown> | undefined,
        em,
      );
      if (mensagem.rotacaoSkinId) {
        const indice = conjuntos.findIndex((conjunto) => conjunto.skinId === mensagem.rotacaoSkinId);
        const avanco = indice >= 0 ? patchAvancoRotacao(conjuntos[indice], em) : undefined;
        if (avanco) conjuntos[indice] = { ...conjuntos[indice], indice: avanco.indice };
      }
      // A frase girou: quem estava barrado pela frase anterior volta à busca.
      barradosAgora.clear();
      saiu = true;
      break;
    }

    segurouNoCursor = saiu ? undefined : segurou;
    if (saiu) metaDesdeOUltimo = false;
    cursor = em;
  }

  const fora = restantes.filter(
    (candidato) =>
      !barrados.has(candidato.id) &&
      (candidato.manual === true || nichoPermitido(candidato.nicho, config.nichosPermitidos)),
  ).length;

  return {
    linhas,
    barrados: [...barrados.values()],
    vencidos,
    fora,
    parouPor: linhas.length >= entrada.alvo ? "alvo" : "horizonte",
    horizonte: limite,
  };
}

/**
 * Os limites do horizonte: `minimo`, o fim do PRÓXIMO dia operacional (a
 * virada de hoje e a seguinte — quem olha às 06:40 vê hoje e amanhã), e
 * `teto`, o fim do `AGENDA_DIAS_MAX`-ésimo (hoje e os seis seguintes).
 */
export function limitesDaAgenda(now: Date, inicioDiaOperacionalHora: number): { minimo: Date; teto: Date } {
  let virada = now;
  let minimo = now;
  for (let dia = 1; dia <= AGENDA_DIAS_MAX; dia++) {
    virada = proximaViradaDiaOperacional(virada, inicioDiaOperacionalHora);
    if (dia === 2) minimo = virada;
  }
  return { minimo, teto: virada };
}

/**
 * O horizonte depois da PRIMEIRA saída, em `em`: o fim do dia operacional
 * dela, mas nunca antes de `minimo` (com alguém saindo hoje, amanhã
 * continua na agenda — a meta de hoje empurra o resto para lá) e nunca
 * depois do `teto`.
 */
export function limiteDepoisDe(
  em: Date,
  limites: { minimo: Date; teto: Date },
  inicioDiaOperacionalHora: number,
): Date {
  const fimDoDia = proximaViradaDiaOperacional(em, inicioDiaOperacionalHora).getTime();
  return new Date(Math.min(limites.teto.getTime(), Math.max(limites.minimo.getTime(), fimDoDia)));
}

/**
 * Monta `GET /api/config/fila/agenda` — SOMENTE LEITURA.
 *
 * Leituras: `config/fila`, `config/app`, `config/automacao`, o contador do
 * dia, o pool (o persistido dentro do TTL; vencido, uma varredura em
 * memória que NÃO é gravada — `lerPoolSemGravar`), as fontes da mensagem
 * uma vez (`/buscas` e as frases — a mesma montagem de `/proximo`) e, por
 * id, o lead e o doc da fila de quem a simulação percorre.
 *
 * **`limite` é o modo do BALÃO** (`?limite=5`): a MESMA simulação, parada
 * nos N primeiros — que são exatamente os N primeiros da agenda inteira,
 * porque ela é sequencial —, e sobre o RETRATO persistido do pool, sem TTL
 * (`lerPoolBruto`, a regra do balão): um indicador que existe em toda tela
 * nunca paga a varredura de `/leads`. Sem pool persistido (o celular nunca
 * pediu tarefa), a agenda sai vazia sem ler mais nada. A resposta diz qual
 * retrato foi usado (`pool.geradoEm`), e o balão o mostra datado.
 */
export async function montarAgendaFila(
  db: AppDb,
  now: Date = new Date(),
  opcoes: { limite?: number } = {},
): Promise<AgendaFila> {
  const [config, app, automacao] = await Promise.all([
    loadFilaConfig(db),
    loadConfig(db),
    loadAutomacaoConfig(db),
  ]);
  const doBalao = opcoes.limite !== undefined;
  const lerPool = async (): Promise<{ pool: PoolCandidatos | undefined; reconstruido: boolean }> =>
    doBalao
      ? { pool: await lerPoolBruto(db), reconstruido: false }
      : lerPoolSemGravar(db, now, { corteLegado: automacao.corteLegado });
  const [contadorCompleto, { pool, reconstruido }] = await Promise.all([
    lerContadorFilaCompleto(db, now, config.inicioDiaOperacionalHora),
    lerPool(),
  ]);
  // As fontes da mensagem só quando há quem simular.
  const [buscas, conjuntos] = pool ? await Promise.all([listBuscas(db), listConjuntos(db)]) : [[], []];

  const alvoDoEstoque =
    Number.isInteger(automacao.alvoEstoque) && automacao.alvoEstoque > 0
      ? Math.min(automacao.alvoEstoque, AGENDA_ALVO_MAX)
      : AGENDA_ALVO_PADRAO;
  const alvo = doBalao ? Math.min(alvoDoEstoque, opcoes.limite as number) : alvoDoEstoque;
  const resultado = await simularAgenda(db, {
    now,
    horizonte: limitesDaAgenda(now, config.inicioDiaOperacionalHora),
    alvo,
    config,
    janelas: app.janelasContato,
    corteLegado: automacao.corteLegado,
    contadorHoje: contadorDoDoc(contadorCompleto as unknown as Record<string, unknown>),
    pool: pool?.candidatos ?? [],
    fontes: { config: app, buscas, conjuntos },
    expiracao: { varreduraRoda: automacao.ativo, prazoHoras: automacao.expiracaoDemoHoras },
  });

  const { horizonte, ...resto } = resultado;
  return {
    geradoEm: now.toISOString(),
    horizonte: horizonte.toISOString(),
    // O DIA operacional em que a agenda termina — o da véspera da virada.
    horizonteDia: diaOperacionalKey(new Date(horizonte.getTime() - 1), config.inicioDiaOperacionalHora),
    diaOperacional: diaOperacionalKey(now, config.inicioDiaOperacionalHora),
    alvo,
    pausada: !config.ativo,
    bloqueada: motivoDeSaude() !== undefined,
    pool: { geradoEm: pool?.geradoEm ?? null, reconstruido, truncado: pool?.truncado === true },
    ...resto,
    ritmo: {
      metaDiaria: config.metaDiaria,
      tetoPorHora: config.tetoPorHora,
      intervaloMinimoSegundos: config.intervaloMinimoSegundos,
    },
  };
}
