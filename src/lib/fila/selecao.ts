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
 * `foraDeJanela` conta quantos passariam em tudo e só esbarraram na hora. É
 * o que separa "estão todos dormindo, volte mais tarde" de "não existe lead
 * pronto para mandar" — dois problemas com donos diferentes.
 */
export function ordenarCandidatos(
  pool: CandidatoFila[],
  config: FilaConfig,
  janelas: JanelasContatoConfig,
  now: Date,
): { elegiveis: CandidatoOrdenado[]; foraDeJanela: number } {
  const aceitos = niveisAceitos(config);
  const elegiveis: Array<CandidatoOrdenado & { criadoEm: string }> = [];
  let foraDeJanela = 0;

  for (const candidato of pool) {
    if (!nichoPermitido(candidato.nicho, config.nichosPermitidos)) continue;
    const nivel = nivelAgora(candidato, janelas, now);
    if (nivel === undefined || !aceitos.includes(nivel)) {
      foraDeJanela += 1;
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
  return { elegiveis: elegiveis.map(({ id, nivel }) => ({ id, nivel })), foraDeJanela };
}
