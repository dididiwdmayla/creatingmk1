import type { LimitesUsuario } from "../usuarios/types";
import type { AppDb, UsageDb, UsageDocRef, UsageTransaction } from "../firestore-like";
import {
  dateKeyRange,
  resetaDiaEm,
  resetaMesEm,
  resetaSemanaEm,
  saoPauloDateKey,
  saoPauloMonthStartKey,
  saoPauloWeekStartKey,
} from "./periodoUsuario";
import { UserQuotaExceededError, type JanelaCotaUsuario, type TipoCotaUsuario } from "./errors";

export type { TipoCotaUsuario, JanelaCotaUsuario } from "./errors";

/**
 * Contadores por usuário por dia (reset por composição de chave com a
 * data — ver periodoUsuario.ts — sem cron). Coleção
 * "usage_users/{userId}/dias" (mesmo truque de path composto que
 * buscas/repo.ts usa para as subcoleções de execução — 3 segmentos, ímpar,
 * como toda coleção do Firestore precisa ser: "usage_users/{userId}" sem o
 * terceiro segmento tem 2 segmentos e o SDK real recusa com "must point to
 * a collection... does not contain an odd number of components", erro que
 * só apareceu em produção porque o FakeFirestore dos testes não validava
 * isso — ver o teste de paridade em fake-firestore.test.ts), um doc por
 * dia, com contadores abertos: `geracoesIA` (gerações de texto da demo,
 * tradução de frase por skin e análise interna do grupo — três ações
 * distintas, um contador só, mesmo espírito de "buscas" somar toda página
 * do Text Search) entrou sem redesenho, e o item do roadmap de fotos/
 * reviews (Places) tem o mesmo caminho livre.
 */
export interface ContadorDiaUsuario {
  buscas: number;
  enriquecimentos: number;
  geracoesIA: number;
}

const ZERO_DIA: ContadorDiaUsuario = { buscas: 0, enriquecimentos: 0, geracoesIA: 0 };

export function usageUsuariosCollection(userId: string): string {
  return `usage_users/${userId}/dias`;
}

/** Contadores malformados (string, negativo, NaN) viram 0 — mesma postura do módulo global. */
function readContadorDia(data: Record<string, unknown> | undefined): ContadorDiaUsuario {
  const contador = { ...ZERO_DIA };
  for (const tipo of ["buscas", "enriquecimentos", "geracoesIA"] as const) {
    const valor = data?.[tipo];
    if (typeof valor === "number" && Number.isFinite(valor) && valor > 0) {
      contador[tipo] = Math.floor(valor);
    }
  }
  return contador;
}

const CAMPO_LIMITE: Record<TipoCotaUsuario, Record<JanelaCotaUsuario, keyof LimitesUsuario>> = {
  buscas: { dia: "buscasDia", semana: "buscasSemana", mes: "buscasMes" },
  enriquecimentos: {
    dia: "enriquecimentosDia",
    semana: "enriquecimentosSemana",
    mes: "enriquecimentosMes",
  },
  geracoesIA: {
    dia: "geracoesIADia",
    semana: "geracoesIASemana",
    mes: "geracoesIAMes",
  },
};

function limiteDaJanela(
  limites: LimitesUsuario | undefined,
  tipo: TipoCotaUsuario,
  janela: JanelaCotaUsuario,
): number | undefined {
  return limites?.[CAMPO_LIMITE[tipo][janela]];
}

async function somarChaves(
  tx: UsageTransaction,
  db: UsageDb,
  colecao: string,
  chaves: string[],
  tipo: TipoCotaUsuario,
  hojeKey: string,
  hojeAtual: ContadorDiaUsuario,
): Promise<number> {
  let total = 0;
  for (const chave of chaves) {
    if (chave === hojeKey) {
      total += hojeAtual[tipo];
      continue;
    }
    const snap = await tx.get(db.collection(colecao).doc(chave));
    total += readContadorDia(snap.exists ? snap.data() : undefined)[tipo];
  }
  return total;
}

export interface CotaUsuarioPendente {
  ref: UsageDocRef;
  proximo: ContadorDiaUsuario;
}

/**
 * Dentro de UMA transação (a mesma do reserveQuota global — atomicidade
 * exigida): lê os docs de dia necessários, verifica cada janela
 * CONFIGURADA (janela sem limite não é lida — a maioria dos usuários só
 * configura o teto diário, então não pagamos até 31 leituras à toa) e
 * devolve o que escrever no commit. Lança UserQuotaExceededError ANTES de
 * qualquer escrita quando alguma janela estouraria.
 */
export async function checarCotaUsuario(
  tx: UsageTransaction,
  db: UsageDb,
  userId: string,
  tipo: TipoCotaUsuario,
  limites: LimitesUsuario | undefined,
  now: Date,
): Promise<CotaUsuarioPendente> {
  const hojeKey = saoPauloDateKey(now);
  const colecao = usageUsuariosCollection(userId);
  const refHoje = db.collection(colecao).doc(hojeKey);
  const hojeSnap = await tx.get(refHoje);
  const hojeAtual = readContadorDia(hojeSnap.exists ? hojeSnap.data() : undefined);

  const limiteDia = limiteDaJanela(limites, tipo, "dia");
  const limiteSemana = limiteDaJanela(limites, tipo, "semana");
  const limiteMes = limiteDaJanela(limites, tipo, "mes");

  if (limiteDia !== undefined && hojeAtual[tipo] + 1 > limiteDia) {
    throw new UserQuotaExceededError(tipo, "dia", hojeAtual[tipo], limiteDia, resetaDiaEm(now));
  }

  if (limiteSemana !== undefined) {
    const chaves = dateKeyRange(saoPauloWeekStartKey(hojeKey), hojeKey);
    const usado = await somarChaves(tx, db, colecao, chaves, tipo, hojeKey, hojeAtual);
    if (usado + 1 > limiteSemana) {
      throw new UserQuotaExceededError(tipo, "semana", usado, limiteSemana, resetaSemanaEm(now));
    }
  }

  if (limiteMes !== undefined) {
    const chaves = dateKeyRange(saoPauloMonthStartKey(hojeKey), hojeKey);
    const usado = await somarChaves(tx, db, colecao, chaves, tipo, hojeKey, hojeAtual);
    if (usado + 1 > limiteMes) {
      throw new UserQuotaExceededError(tipo, "mes", usado, limiteMes, resetaMesEm(now));
    }
  }

  return { ref: refHoje, proximo: { ...hojeAtual, [tipo]: hojeAtual[tipo] + 1 } };
}

export interface JanelaUso {
  usado: number;
  limite?: number;
  resetaEm: string;
}

export interface UsoUsuario {
  dia: JanelaUso;
  semana: JanelaUso;
  mes: JanelaUso;
}

/**
 * Leitura (fora de transação, só para exibição — dashboard/painel admin):
 * uso de hoje/semana/mês de um tipo, com o limite ao lado (ausente = sem
 * limite naquela janela). Diferente de checarCotaUsuario, sempre lê as
 * três janelas — é a tela que precisa mostrar "usado / limite" mesmo sem
 * limite configurado.
 */
export async function getUsoUsuario(
  db: UsageDb,
  userId: string,
  tipo: TipoCotaUsuario,
  limites: LimitesUsuario | undefined,
  now: Date = new Date(),
): Promise<UsoUsuario> {
  const hojeKey = saoPauloDateKey(now);
  const colecao = usageUsuariosCollection(userId);

  const inicioMes = saoPauloMonthStartKey(hojeKey);
  const chavesMes = dateKeyRange(inicioMes, hojeKey);
  const contadores = new Map<string, ContadorDiaUsuario>();
  for (const chave of chavesMes) {
    const snap = await db.collection(colecao).doc(chave).get();
    contadores.set(chave, readContadorDia(snap.exists ? snap.data() : undefined));
  }

  const inicioSemana = saoPauloWeekStartKey(hojeKey);
  const somar = (chaves: string[]): number =>
    chaves.reduce((total, chave) => total + (contadores.get(chave)?.[tipo] ?? 0), 0);

  return {
    dia: {
      usado: contadores.get(hojeKey)?.[tipo] ?? 0,
      limite: limiteDaJanela(limites, tipo, "dia"),
      resetaEm: resetaDiaEm(now),
    },
    semana: {
      usado: somar(dateKeyRange(inicioSemana, hojeKey)),
      limite: limiteDaJanela(limites, tipo, "semana"),
      resetaEm: resetaSemanaEm(now),
    },
    mes: {
      usado: somar(chavesMes),
      limite: limiteDaJanela(limites, tipo, "mes"),
      resetaEm: resetaMesEm(now),
    },
  };
}

/** Zera o contador do dia corrente (botão "zerar dia" do painel admin). */
export async function zerarCotaDia(db: AppDb, userId: string, now: Date = new Date()): Promise<void> {
  const hojeKey = saoPauloDateKey(now);
  const ref = db.collection(usageUsuariosCollection(userId)).doc(hojeKey);
  await ref.set({ ...ZERO_DIA, atualizadoEm: now.toISOString() });
}
