import { barraDoDia, proximoMomentoAceito, type ProximoMomento } from "@/lib/leads/barraDoDia";
import { MIN_DIA, minutoDaSemanaLocal } from "@/lib/leads/horarios";
import type { JanelasContatoConfig, NivelContato } from "@/lib/leads/janelaContato";
import type { Lead } from "@/lib/leads/types";
import { normalizaNicho } from "@/lib/precificacao/calc";

import type { CandidatoFila } from "./candidatos";
import type { FilaConfig } from "./config";
import {
  contadorDoDoc,
  contadorNoInstante,
  diaOperacionalKey,
  momentoFimIntervalo,
  momentoFimTetoHora,
  proximaViradaDiaOperacional,
  snapshotDoContador,
  type FilaContadorDoc,
  type FilaContadorSnapshot,
} from "./contadores";

/**
 * A DECISÃO da fila, pura: dado o pool, a config e o instante, quem é o
 * próximo — e, quando não é ninguém, POR QUÊ.
 *
 * O motivo é o produto principal desta função, não um detalhe da resposta. É
 * ele que responde, de manhã, por que saíram 4 mensagens e não 15: "teto por
 * hora" e "todo mundo dormindo" e "não tem lead com print pronto" pedem três
 * providências diferentes, e colapsar os três num "sem tarefa" genérico
 * apagaria justamente a informação que faz agir.
 */

export const MOTIVOS_SEM_TAREFA = [
  "pausado",
  "meta_atingida",
  "teto_hora",
  "intervalo",
  "fora_de_janela",
  "sem_leads_elegiveis",
] as const;

export type MotivoSemTarefa = (typeof MOTIVOS_SEM_TAREFA)[number];

/** Os motivos que não dependem de lead nenhum — os portões de `motivoDeRitmo`. */
export type MotivoRitmo = Exclude<MotivoSemTarefa, "fora_de_janela" | "sem_leads_elegiveis">;

/** Candidato aprovado na janela, com o nível que o aprovou. */
export interface CandidatoOrdenado {
  id: string;
  nivel: NivelContato;
}

/**
 * Quantos candidatos do pool pararam na janela, quebrado por nível — é o
 * que separa "a config não pegou" (razoavel parado com `exigirJanelaBoa`
 * true) de "está todo mundo fechado agora" (`semNivel`).
 */
export interface DiagnosticoJanela {
  razoavel: number;
  ruim: number;
  semNivel: number;
}

/**
 * Um candidato que passou no nicho e parou na JANELA, com o nível que ele
 * tem agora (ausente = fechado na hora dele). É a linha que o painel
 * mostra em "bloqueados por janela"; só é coletado sob demanda (ver
 * `ordenarCandidatos`).
 */
export interface CandidatoBloqueado {
  id: string;
  /** Nível agora; ausente quando o lead está FECHADO neste minuto. */
  nivel?: NivelContato;
}

/**
 * O diagnóstico das etapas FRESCAS da seleção (nicho e janela) — calculado
 * sobre o pool, na mesma passada que escolhe os elegíveis. As contagens
 * estruturais (etapa anterior, "quantos leads nem chegaram a ser
 * candidatos") ficam em `PoolCandidatos.estrutural` (`lib/fila/candidatos.ts`),
 * congeladas no rebuild — ver `/api/fila/diagnostico`, que junta as duas.
 */
export interface DiagnosticoSelecao {
  /** Passariam na janela, mas o nicho deles não está em `nichosPermitidos`. */
  nichoBarrado: number;
  janela: DiagnosticoJanela;
  /**
   * Quem parou na janela, identificado — vazio quando ninguém pediu
   * (`coletarBloqueados`), que é o caso de `/proximo`. A rota de execução
   * conta; só o painel precisa de nomes, e ele é aberto por uma pessoa de
   * vez em quando, não 1440× por dia.
   */
  bloqueados: CandidatoBloqueado[];
}

/**
 * Portões que não dependem de lead nenhum — pausa e ritmo. Ficam ANTES da
 * leitura do pool de propósito: são 2 leituras de doc, e barram a enorme
 * maioria das chamadas da noite sem encostar em `/leads`.
 */
export function motivoDeRitmo(
  config: FilaConfig,
  contador: FilaContadorSnapshot,
): MotivoRitmo | undefined {
  if (!config.ativo) return "pausado";
  if (contador.totalDoDia >= config.metaDiaria) return "meta_atingida";
  if (contador.ultimaHora >= config.tetoPorHora) return "teto_hora";
  if (
    contador.segundosDesdeUltimoEvento !== null &&
    contador.segundosDesdeUltimoEvento < config.intervaloMinimoSegundos
  ) {
    return "intervalo";
  }
  return undefined;
}

/**
 * O nicho do lead está liberado? Lista vazia = todos. O confronto é por
 * SUBSTRING sobre o nicho normalizado, mesmo espírito de `familiaDoLead`:
 * "barbearia" na lista pega o lead que veio da busca "barbearia masculina".
 * Lead sem nicho fica de fora quando há lista — não dá para provar que ele
 * é de um nicho liberado.
 */
export function nichoPermitido(nicho: string, permitidos: string[]): boolean {
  if (permitidos.length === 0) return true;
  if (!nicho) return false;
  return permitidos.some((permitido) => {
    const alvo = normalizaNicho(permitido);
    return alvo !== "" && nicho.includes(alvo);
  });
}

/**
 * A forma mínima de lead que as regras de janela (`barraDoDia` e
 * `proximoMomentoAceito`) leem, reconstruída a partir do que o pool guardou
 * já resolvido. Existe para a regra de janela continuar num lugar só
 * (faixas da família × horário de funcionamento × fuso do lead) — e é
 * exportada porque o painel da /config calcula a PRÓXIMA faixa aceita
 * sobre a mesma entrada de pool, e duas reconstruções divergiriam.
 */
export function leadSinteticoDoCandidato(
  candidato: CandidatoFila,
): Pick<Lead, "busca" | "horarios" | "endereco"> {
  return {
    busca: { nicho: candidato.nicho, regiao: "", em: candidato.criadoEm },
    horarios: {
      faixas: candidato.faixas,
      utcOffsetMinutes: candidato.offset,
      obtidoEm: candidato.criadoEm,
    },
  };
}

/** A janela de contato do candidato AGORA, sobre o lead sintético acima. */
function nivelAgora(
  candidato: CandidatoFila,
  janelas: JanelasContatoConfig,
  now: Date,
): NivelContato | undefined {
  const barra = barraDoDia(janelas, leadSinteticoDoCandidato(candidato), now);
  // Fechado agora não tem nível: fora do funcionamento não se aborda.
  return barra?.aberto ? barra.nivelAgora : undefined;
}

/** Níveis que a config aceita neste momento. */
export function niveisAceitos(config: FilaConfig): NivelContato[] {
  return config.exigirJanelaBoa ? ["bom"] : ["bom", "razoavel"];
}

/**
 * Os candidatos entregáveis AGORA, na ordem de atendimento:
 *
 *   nível de janela  →  MANUAL antes de natural  →  `criadoEm`  →  id
 *
 * O NÍVEL VEM PRIMEIRO, e isso não é detalhe de implementação: um lead
 * escolhido à mão em janela "razoavel" NÃO passa na frente de um lead natural
 * em "bom", porque entregar em janela pior custa resposta — e a fila inteira
 * existe para falar com o negócio na hora em que ele atende. A seleção manual
 * fura a POLÍTICA (o nicho permitido e a ordem natural), nunca o relógio do
 * outro lado.
 *
 * Dentro do mesmo nível, o manual vem antes do FIFO por `criadoEm` — é
 * exatamente o que "escolhi este agora" quer dizer. Desempate final por id
 * para a ordem ser determinística, e não depender da ordem em que o Firestore
 * devolveu os docs.
 *
 * **Esta é a ÚNICA ordenação da fila.** O painel da /config e o balão
 * mostram o que esta função devolve; nenhum dos dois ordena por conta
 * própria, porque duas ordenações seriam duas verdades sobre quem é o
 * próximo e divergiriam em silêncio.
 *
 * UMA PASSAGEM SÓ sobre o pool: escolhe e diagnostica ao mesmo tempo — nunca
 * duas varreduras, uma para decidir e outra para contar. `diagnostico`
 * conta quem passaria em tudo e esbarrou no nicho, e quem passaria no nicho
 * e esbarrou na hora (quebrado por nível: é o que separa "está todo mundo
 * fechado agora" de "a config não pegou" — ver `DiagnosticoJanela`).
 *
 * `coletarBloqueados` acrescenta a essa mesma passagem a LISTA de quem
 * parou na janela, na mesma ordem justa (mais antigo primeiro). Fica
 * opt-in porque `/proximo` roda de minuto em minuto e não tem o que fazer
 * com ela — montar um array de até `POOL_MAX` itens 1440× por dia para
 * ninguém ler é desperdício. Quem pede é o painel da /config, aberto por
 * uma pessoa de vez em quando.
 */
export function ordenarCandidatos(
  pool: CandidatoFila[],
  config: FilaConfig,
  janelas: JanelasContatoConfig,
  now: Date,
  opcoes: { coletarBloqueados?: boolean } = {},
): { escolhido: CandidatoOrdenado[]; diagnostico: DiagnosticoSelecao } {
  const aceitos = niveisAceitos(config);
  const elegiveis: Array<CandidatoOrdenado & { criadoEm: string; manual: boolean }> = [];
  let nichoBarrado = 0;
  const janela: DiagnosticoJanela = { razoavel: 0, ruim: 0, semNivel: 0 };
  const bloqueados: Array<CandidatoBloqueado & { criadoEm: string }> = [];

  for (const candidato of pool) {
    const manual = candidato.manual === true;
    // O NICHO é política, e é o que a seleção manual fura: o operador olhou
    // aquele negócio e decidiu falar com ele. `nichoBarrado` não conta quem
    // furou — quem não foi barrado não pode aparecer como barrado no funil.
    if (!manual && !nichoPermitido(candidato.nicho, config.nichosPermitidos)) {
      nichoBarrado += 1;
      continue;
    }
    // A JANELA vale igual para o manual: ela não é política do operador, é a
    // hora do outro lado. Lead manual fora de janela cai em `bloqueados`
    // como qualquer outro.
    const nivel = nivelAgora(candidato, janelas, now);
    if (nivel === undefined || !aceitos.includes(nivel)) {
      if (nivel === undefined) janela.semNivel += 1;
      else if (nivel === "razoavel") janela.razoavel += 1;
      else janela.ruim += 1;
      if (opcoes.coletarBloqueados) {
        bloqueados.push({ id: candidato.id, criadoEm: candidato.criadoEm, ...(nivel && { nivel }) });
      }
      continue;
    }
    elegiveis.push({ id: candidato.id, nivel, criadoEm: candidato.criadoEm, manual });
  }

  elegiveis.sort(
    (a, b) =>
      aceitos.indexOf(a.nivel) - aceitos.indexOf(b.nivel) ||
      // Só DEPOIS do nível: manual em "razoavel" não passa na frente de
      // natural em "bom" (ver o cabeçalho). `true` primeiro.
      Number(b.manual) - Number(a.manual) ||
      a.criadoEm.localeCompare(b.criadoEm) ||
      a.id.localeCompare(b.id),
  );
  // Sem nível a ordenar por (nenhum deles está em `aceitos`), a ordem dos
  // bloqueados é só a justa: quem esperou mais aparece primeiro.
  bloqueados.sort(
    (a, b) => a.criadoEm.localeCompare(b.criadoEm) || a.id.localeCompare(b.id),
  );
  return {
    escolhido: elegiveis.map(({ id, nivel }) => ({ id, nivel })),
    diagnostico: {
      nichoBarrado,
      janela,
      bloqueados: bloqueados.map(({ id, nivel }) => ({ id, ...(nivel && { nivel }) })),
    },
  };
}

/**
 * O motivo quando NENHUM candidato de `escolhido` virou tarefa — extraído de
 * `/proximo` (que chama isto só depois de esgotar a tentativa de ENTREGA de
 * cada um) para `GET /api/fila/resumo` poder chegar ao mesmo motivo sem
 * reimplementar a distinção. `escolhidoLength` continua explícito (em vez de
 * assumir 0) porque `/proximo` chega aqui mesmo com `escolhido` não vazio
 * quando todos falharam na releitura fresca (pool desatualizado) — nesse
 * caso o motivo é "sem_leads_elegiveis", nunca "fora_de_janela", ainda que
 * outros candidatos do pool tenham parado na janela.
 */
export function motivoSemTarefaAgora(
  escolhidoLength: number,
  diagnostico: DiagnosticoSelecao,
): "fora_de_janela" | "sem_leads_elegiveis" {
  const foraDeJanela = diagnostico.janela.razoavel + diagnostico.janela.ruim + diagnostico.janela.semNivel;
  return escolhidoLength === 0 && foraDeJanela > 0 ? "fora_de_janela" : "sem_leads_elegiveis";
}

/** A decisão de `ordenarCandidatos` mais o MOTIVO — ver `decidirFila`. */
export interface DecisaoFila {
  motivo: MotivoSemTarefa | "";
  escolhido: CandidatoOrdenado[];
  diagnostico: DiagnosticoSelecao;
}

/**
 * A decisão PURA e COMPLETA da fila: dado o pool, a config, as janelas, o
 * contador do dia e o instante, qual é o motivo de não haver tarefa agora
 * (ou `""` quando há) — a MESMA cadeia de portões que `/proximo` percorre
 * (ritmo → nicho → janela) antes de tentar reservar, numa função só.
 *
 * Existe para `GET /api/fila/resumo`, que NUNCA reserva e por isso não pode
 * chamar `/proximo`: precisa do motivo sem pagar o custo (nem o efeito
 * colateral) de uma claim. `/proximo` continua com o próprio atalho de custo
 * — só carrega o pool depois de passar pelo ritmo — e por isso NÃO chama
 * esta função (que sempre roda `ordenarCandidatos` sobre um pool já
 * carregado); reusa só `motivoSemTarefaAgora` acima, o pedaço que os dois
 * precisam idêntico.
 *
 * Diferença deliberada do caminho de `/proximo`: aqui o ritmo NÃO impede de
 * calcular `escolhido`/`diagnostico` — o resumo precisa de `elegiveisAgora`
 * (quantos passariam nos filtros DE LEAD) mesmo com a fila pausada ou a meta
 * batida, que são situações diferentes de "pausada e vazia".
 */
export function decidirFila(
  pool: CandidatoFila[],
  config: FilaConfig,
  janelas: JanelasContatoConfig,
  contador: FilaContadorSnapshot,
  now: Date,
  opcoes: { coletarBloqueados?: boolean } = {},
): DecisaoFila {
  const { escolhido, diagnostico } = ordenarCandidatos(pool, config, janelas, now, opcoes);
  const ritmo = motivoDeRitmo(config, contador);
  const motivo: MotivoSemTarefa | "" =
    ritmo ?? (escolhido.length > 0 ? "" : motivoSemTarefaAgora(escolhido.length, diagnostico));
  return { motivo, escolhido, diagnostico };
}

/* ── QUEM SAI, E QUANDO ────────────────────────────────────────────────
 *
 * A mesma cadeia de portões de cima (ritmo → nicho → janela), perguntada
 * num instante QUALQUER e não só "agora". `/api/fila/proximo` pergunta com
 * `ate = agora` (sai agora, ou o motivo); a AGENDA da fila
 * (`lib/fila/agenda.ts`) pergunta com um horizonte e um relógio que anda.
 * Uma função só para as duas: se a agenda e a fila pudessem discordar, a
 * agenda não serviria para nada.
 */

/**
 * O estado de que a decisão depende, inteiro e sem banco: a config, as
 * faixas de contato, o pool e o contador de CADA dia operacional que o
 * relógio pode atravessar (a chave é `diaOperacionalKey`). Dia ausente é o
 * dia que ainda não tem doc — sem envio nenhum, exatamente como
 * `lerContadorFilaCompleto` o lê.
 */
export interface EstadoFila {
  config: FilaConfig;
  janelas: JanelasContatoConfig;
  pool: CandidatoFila[];
  contadores: Readonly<Record<string, FilaContadorDoc>>;
}

/**
 * Resultado de `proximaSaida`: alguém sai em `em`, com a ordem daquele
 * instante — ou nada sai até o horizonte, e o motivo.
 */
export type SaidaFila =
  | {
      /** O primeiro instante em que a fila entrega alguém. */
      em: Date;
      /** A ordem de atendimento NESSE instante (`ordenarCandidatos`) — nunca vazia. */
      fila: CandidatoOrdenado[];
      /** O diagnóstico de nicho/janela da passada de `em`. */
      diagnostico: DiagnosticoSelecao;
      /** O motivo em `desde`; `""` quando a saída é em `desde`. */
      motivoEmDesde: MotivoSemTarefa | "";
      /**
       * O ÚLTIMO portão que segurou a fila antes de `em` — o "por que este
       * horário" da agenda. Ausente quando a saída é em `desde`.
       */
      segurou?: MotivoSemTarefa;
    }
  | {
      em?: undefined;
      fila: [];
      /**
       * O diagnóstico da última passada de `ordenarCandidatos`; ausente
       * quando o ritmo barrou o tempo todo e nenhuma passada aconteceu.
       */
      diagnostico?: DiagnosticoSelecao;
      /** Por que nada sai em `desde`. */
      motivoEmDesde: MotivoSemTarefa;
      segurou?: undefined;
    };

/** Teto de passos de `proximaSaida` — cada passo avança o relógio; é só a rede contra laço infinito. */
const PASSOS_MAX = 10_000;

/**
 * O par `{ offsetDias, inicioMin }` que `proximoMomentoAceito` devolve, no
 * calendário LOCAL DO LEAD, como um INSTANTE ABSOLUTO — no início do minuto
 * (a janela abre às 09:00:00, não às 09:00:37 de quem perguntou às 06:40:37).
 *
 * A aritmética funciona porque `offsetMinutos` é constante entre agora e o
 * alvo (mesma simplificação que o resto da fila já assume — o Brasil e a
 * maioria dos fusos não mudam de deslocamento de um dia para o outro):
 * avançar N minutos no relógio de parede local É avançar N minutos reais.
 */
export function instanteDoMomento(
  momento: Pick<ProximoMomento, "offsetDias" | "inicioMin">,
  offsetMinutos: number,
  now: Date,
): Date {
  const minutoDoDiaAgora = minutoDaSemanaLocal(offsetMinutos, now) % MIN_DIA;
  const deltaMin = momento.offsetDias * MIN_DIA + momento.inicioMin - minutoDoDiaAgora;
  const inicioDoMinuto = Math.floor(now.getTime() / 60_000) * 60_000;
  return new Date(inicioDoMinuto + deltaMin * 60_000);
}

/**
 * O próximo instante, DEPOIS de `now`, em que algum candidato do pool entra
 * numa faixa ACEITA — o que resolve `fora_de_janela`. Considera só quem o
 * nicho não barra (o manual fura o nicho, como em `ordenarCandidatos`): o
 * barrado pelo nicho não entra em janela nenhuma que o resolva.
 *
 * Usa `proximoMomentoAceito` com os NÍVEIS ACEITOS da config — nunca
 * `proximoBom`: com `exigirJanelaBoa === false` o próximo aceito é "bom" OU
 * "razoável", que vem antes do próximo bom (a armadilha documentada em
 * `lib/leads/barraDoDia.ts`).
 */
export function proximaAberturaDeJanela(
  pool: CandidatoFila[],
  config: FilaConfig,
  janelas: JanelasContatoConfig,
  now: Date,
): Date | undefined {
  const niveis = niveisAceitos(config);
  let melhor: Date | undefined;
  for (const candidato of pool) {
    if (candidato.manual !== true && !nichoPermitido(candidato.nicho, config.nichosPermitidos)) continue;
    const momento = proximoMomentoAceito(janelas, leadSinteticoDoCandidato(candidato), niveis, now);
    if (!momento) continue;
    const instante = instanteDoMomento(momento, candidato.offset, now);
    // Quem já está numa faixa aceita AGORA não resolve nada "depois" — e
    // não deveria chegar aqui (estaria em `escolhido`). A guarda impede o
    // relógio de ficar parado.
    if (instante.getTime() <= now.getTime()) continue;
    if (!melhor || instante.getTime() < melhor.getTime()) melhor = instante;
  }
  return melhor;
}

/**
 * Quando o portão de RITMO `motivo` deixa de barrar, a partir do doc do dia
 * em `now` — ou `undefined` quando nenhum instante resolve (`pausado`, ou o
 * caso degenerado de `momentoFimTetoHora`).
 *
 * Nunca depois da VIRADA do dia operacional: o doc do dia seguinte nasce
 * vazio — sem envios na última hora, sem último evento —, então teto e
 * intervalo também liberam ali, e não só a meta. É o que a fila real faz,
 * porque é o doc do dia que ela lê.
 */
function liberacaoDoRitmo(
  motivo: MotivoRitmo,
  doc: FilaContadorDoc,
  config: FilaConfig,
  now: Date,
): Date | undefined {
  if (motivo === "pausado") return undefined;
  const virada = proximaViradaDiaOperacional(now, config.inicioDiaOperacionalHora);
  const libera =
    motivo === "meta_atingida"
      ? virada
      : motivo === "teto_hora"
        ? momentoFimTetoHora(doc, config.tetoPorHora, now)
        : momentoFimIntervalo(doc, config.intervaloMinimoSegundos);
  if (!libera) return motivo === "teto_hora" ? undefined : virada;
  return libera.getTime() < virada.getTime() ? libera : virada;
}

/**
 * QUEM SAI E QUANDO — puro. Percorre o relógio a partir de `desde` e devolve
 * o primeiro instante (até `ate`, inclusive) em que a fila entrega alguém,
 * com a ordem de atendimento naquele instante; ou, se nada sai até `ate`, o
 * motivo.
 *
 * Em cada instante examinado roda a MESMA cadeia de `/api/fila/proximo`:
 * `motivoDeRitmo` sobre o contador do dia operacional DAQUELE instante
 * (`contadorNoInstante`), depois `ordenarCandidatos`. Quando ninguém sai, o
 * relógio pula para o próximo instante em que o portão que barrou pode
 * mudar de ideia — a liberação do ritmo (`momentoFimIntervalo`,
 * `momentoFimTetoHora`, a virada do dia) ou a próxima faixa aceita
 * (`proximaAberturaDeJanela`). O salto só ACELERA a busca: quem decide se
 * sai é sempre a cadeia de portões, no instante de chegada.
 *
 * `/proximo` chama com `ate = desde = agora`: sai agora, ou o motivo — a
 * pergunta de sempre. A AGENDA chama com um horizonte.
 *
 * O que esta função NÃO decide é a releitura fresca de cada lead (doc do
 * lead, reserva, mensagem montada, marcadores): isso é por lead, depois da
 * ordem — `printParaEntrega` e `vereditoDaMensagem` (`lib/fila/entrega.ts`).
 */
export function proximaSaida(estado: EstadoFila, desde: Date, opcoes: { ate: Date }): SaidaFila {
  const { config, janelas, pool } = estado;
  let instante = desde;
  let motivoEmDesde: MotivoSemTarefa | undefined;
  let segurou: MotivoSemTarefa | undefined;
  let diagnostico: DiagnosticoSelecao | undefined;

  for (let passo = 0; passo < PASSOS_MAX; passo++) {
    const chave = diaOperacionalKey(instante, config.inicioDiaOperacionalHora);
    const doc = estado.contadores[chave] ?? contadorDoDoc(undefined);
    const ritmo = motivoDeRitmo(config, snapshotDoContador(contadorNoInstante(doc, instante)));

    let motivo: MotivoSemTarefa = ritmo ?? "sem_leads_elegiveis";
    if (!ritmo) {
      const ordem = ordenarCandidatos(pool, config, janelas, instante);
      diagnostico = ordem.diagnostico;
      if (ordem.escolhido.length > 0) {
        return {
          em: instante,
          fila: ordem.escolhido,
          diagnostico,
          motivoEmDesde: motivoEmDesde ?? "",
          ...(segurou && { segurou }),
        };
      }
      motivo = motivoSemTarefaAgora(0, ordem.diagnostico);
    }
    motivoEmDesde ??= motivo;
    segurou = motivo;

    // Sem horizonte à frente (o caso de `/proximo`, `ate = desde`), nem se
    // calcula o salto: a próxima faixa de cada candidato custaria CPU a cada
    // minuto da noite para uma resposta que ninguém lê.
    const seguinte =
      instante.getTime() >= opcoes.ate.getTime()
        ? undefined
        : ritmo
          ? liberacaoDoRitmo(ritmo, doc, config, instante)
          : motivo === "fora_de_janela"
            ? proximaAberturaDeJanela(pool, config, janelas, instante)
            : // "sem_leads_elegiveis" é não existir lead pronto: nenhuma espera resolve.
              undefined;
    if (!seguinte || seguinte.getTime() > opcoes.ate.getTime()) {
      return { fila: [], motivoEmDesde, ...(diagnostico && { diagnostico }) };
    }
    instante = seguinte;
  }
  return {
    fila: [],
    motivoEmDesde: motivoEmDesde ?? "sem_leads_elegiveis",
    ...(diagnostico && { diagnostico }),
  };
}
