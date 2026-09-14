import { addDays, saoPauloDateKey } from "@/lib/costs/periodoUsuario";
import type { AppDb } from "@/lib/firestore-like";

/**
 * `/filaContadores/{YYYY-MM-DD}` — um doc por DIA OPERACIONAL (não
 * calendário UTC nem meia-noite fixa de São Paulo): o operador pode querer
 * que o dia da fila só vire de madrugada, depois do expediente — ver
 * `FilaConfig.inicioDiaOperacionalHora`. É a mesma ideia de janela local
 * de `costs/periodoUsuario.ts`, com um parâmetro a mais (a hora de corte).
 */
export const FILA_CONTADORES_COLLECTION = "filaContadores";

const SP_TIME_ZONE = "America/Sao_Paulo";
const HOUR_FORMATTER = new Intl.DateTimeFormat("en-US", {
  timeZone: SP_TIME_ZONE,
  hourCycle: "h23",
  hour: "2-digit",
});

function saoPauloHour(now: Date): number {
  return Number(HOUR_FORMATTER.format(now));
}

/**
 * Chave do dia operacional (YYYY-MM-DD, America/Sao_Paulo). Antes de
 * `inicioHora`, o instante ainda conta como o dia ANTERIOR — assim um
 * plantão que atravessa a meia-noite não vê a cota resetar no meio.
 * `inicioHora` 0 (ou ≤0) é meia-noite normal: mesma chave de
 * `saoPauloDateKey`, sem nenhuma correção.
 */
export function diaOperacionalKey(now: Date, inicioHora: number): string {
  const hoje = saoPauloDateKey(now);
  if (inicioHora <= 0) return hoje;
  return saoPauloHour(now) < inicioHora ? addDays(hoje, -1) : hoje;
}

const UMA_HORA_MS = 60 * 60 * 1000;

export interface FilaContadorDoc {
  enviados: number;
  /** ISO de cada envio confirmado do dia — só as últimas 24h são mantidas. */
  envios: string[];
  ultimoEventoEm: string | null;
}

export interface FilaContadorSnapshot {
  /** Total de envios confirmados no dia operacional corrente. */
  totalDoDia: number;
  /** Quantos envios caem na última hora corrida a partir de `now`. */
  ultimaHora: number;
  /** Segundos desde o último evento registrado; `null` se nunca houve um. */
  segundosDesdeUltimoEvento: number | null;
}

function readContadorDoc(data: Record<string, unknown> | undefined): FilaContadorDoc {
  const enviados = typeof data?.enviados === "number" && Number.isFinite(data.enviados)
    ? data.enviados
    : 0;
  const envios = Array.isArray(data?.envios)
    ? data.envios.filter((iso): iso is string => typeof iso === "string")
    : [];
  const ultimoEventoEm = typeof data?.ultimoEventoEm === "string" ? data.ultimoEventoEm : null;
  return { enviados, envios, ultimoEventoEm };
}

/**
 * Snapshot dos contadores da fila para um instante qualquer: total do dia
 * operacional, quantos envios na última hora deslizante (usa `envios`, não
 * `enviados` — é a janela de 1h que precisa das marcas de tempo) e segundos
 * desde o último evento (`null` = ainda não houve nenhum). Doc ausente é o
 * dia sem nenhum envio ainda — nunca erro.
 */
export async function lerContadorFila(
  db: AppDb,
  now: Date,
  inicioDiaOperacionalHora: number,
): Promise<FilaContadorSnapshot> {
  const chave = diaOperacionalKey(now, inicioDiaOperacionalHora);
  const snap = await db.collection(FILA_CONTADORES_COLLECTION).doc(chave).get();
  const doc = readContadorDoc(snap.exists ? snap.data() : undefined);

  const limiteHora = now.getTime() - UMA_HORA_MS;
  const ultimaHora = doc.envios.filter((iso) => {
    const t = new Date(iso).getTime();
    return Number.isFinite(t) && t > limiteHora;
  }).length;

  const segundosDesdeUltimoEvento = doc.ultimoEventoEm
    ? Math.max(0, Math.floor((now.getTime() - new Date(doc.ultimoEventoEm).getTime()) / 1000))
    : null;

  return { totalDoDia: doc.enviados, ultimaHora, segundosDesdeUltimoEvento };
}

/**
 * O doc do contador DEPOIS de mais um envio confirmado, puro — o incremento
 * acontece dentro da transação que confirma o envio (ver
 * `lib/fila/confirmar.ts`), então a regra tem que ser aplicável a um doc já
 * lido, sem tocar o banco.
 *
 * `envios` é podado para as últimas 24h na mesma passada: o array existe só
 * para a janela deslizante de 1h, e sem a poda ele cresceria para sempre num
 * doc que é reescrito a cada envio.
 */
export function contadorComEnvio(
  data: Record<string, unknown> | undefined,
  now: Date,
): FilaContadorDoc {
  const atual = readContadorDoc(data);
  const limite24h = now.getTime() - 24 * UMA_HORA_MS;
  const em = now.toISOString();
  const envios = atual.envios.filter((iso) => {
    const t = new Date(iso).getTime();
    return Number.isFinite(t) && t > limite24h;
  });
  return { enviados: atual.enviados + 1, envios: [...envios, em], ultimoEventoEm: em };
}
