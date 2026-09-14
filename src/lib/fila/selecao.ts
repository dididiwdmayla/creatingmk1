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
 * A janela de contato do candidato AGORA. Reconstrói a forma mínima de lead
 * que `barraDoDia` lê, a partir do que o pool guardou já resolvido — assim a
 * regra de janela continua existindo num lugar só (faixas da família ×
 * horário de funcionamento × fuso do lead), sem uma segunda cópia aqui.
 */
function nivelAgora(
  candidato: CandidatoFila,
  janelas: JanelasContatoConfig,
  now: Date,
): NivelContato | undefined {
  const sintetico: Pick<Lead, "busca" | "horarios" | "endereco"> = {
    busca: { nicho: candidato.nicho, regiao: "", em: candidato.criadoEm },
    horarios: {
      faixas: candidato.faixas,
      utcOffsetMinutes: candidato.offset,
      obtidoEm: candidato.criadoEm,
    },
  };
  const barra = barraDoDia(janelas, sintetico, now);
  // Fechado agora não tem nível: fora do funcionamento não se aborda.
  return barra?.aberto ? barra.nivelAgora : undefined;
}

/** Níveis que a config aceita neste momento. */
export function niveisAceitos(config: FilaConfig): NivelContato[] {
  return config.exigirJanelaBoa ? ["bom"] : ["bom", "razoavel"];
}

/**
 * Os candidatos entregáveis AGORA, na ordem de atendimento: janela `bom`
 * antes de `razoavel` (a hora melhor primeiro), e dentro do mesmo nível o
 * mais ANTIGO na base primeiro — quem esperou mais é atendido antes.
 * Desempate por id para a ordem ser determinística, e não depender da ordem
 * em que o Firestore devolveu os docs.
 *
 * UMA PASSAGEM SÓ sobre o pool: escolhe e diagnostica ao mesmo tempo — nunca
 * duas varreduras, uma para decidir e outra para contar. `diagnostico`
 * conta quem passaria em tudo e esbarrou no nicho, e quem passaria no nicho
 * e esbarrou na hora (quebrado por nível: é o que separa "está todo mundo
 * fechado agora" de "a config não pegou" — ver `DiagnosticoJanela`).
 */
export function ordenarCandidatos(
  pool: CandidatoFila[],
  config: FilaConfig,
  janelas: JanelasContatoConfig,
  now: Date,
): { escolhido: CandidatoOrdenado[]; diagnostico: DiagnosticoSelecao } {
  const aceitos = niveisAceitos(config);
  const elegiveis: Array<CandidatoOrdenado & { criadoEm: string }> = [];
  let nichoBarrado = 0;
  const janela: DiagnosticoJanela = { razoavel: 0, ruim: 0, semNivel: 0 };

  for (const candidato of pool) {
    if (!nichoPermitido(candidato.nicho, config.nichosPermitidos)) {
      nichoBarrado += 1;
      continue;
    }
    const nivel = nivelAgora(candidato, janelas, now);
    if (nivel === undefined || !aceitos.includes(nivel)) {
      if (nivel === undefined) janela.semNivel += 1;
      else if (nivel === "razoavel") janela.razoavel += 1;
      else janela.ruim += 1;
      continue;
    }
    elegiveis.push({ id: candidato.id, nivel, criadoEm: candidato.criadoEm });
  }

  elegiveis.sort(
    (a, b) =>
      aceitos.indexOf(a.nivel) - aceitos.indexOf(b.nivel) ||
      a.criadoEm.localeCompare(b.criadoEm) ||
      a.id.localeCompare(b.id),
  );
  return {
    escolhido: elegiveis.map(({ id, nivel }) => ({ id, nivel })),
    diagnostico: { nichoBarrado, janela },
  };
}
