import { barraDoDia } from "@/lib/leads/barraDoDia";
import type { JanelasContatoConfig, NivelContato } from "@/lib/leads/janelaContato";
import type { Lead } from "@/lib/leads/types";
import { normalizaNicho } from "@/lib/precificacao/calc";

import type { CandidatoFila } from "./candidatos";
import type { FilaConfig } from "./config";
import type { FilaContadorSnapshot } from "./contadores";

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
): MotivoSemTarefa | undefined {
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
