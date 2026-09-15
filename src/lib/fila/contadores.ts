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

const PARTES_FORMATTER = new Intl.DateTimeFormat("en-US", {
  timeZone: SP_TIME_ZONE,
  hourCycle: "h23",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
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

/**
 * Deslocamento UTC de São Paulo NO INSTANTE dado, em minutos — derivado da
 * base IANA, não fixado em -180. O Brasil não observa horário de verão
 * desde 2019, mas depender da tabela em vez de um número cravado é de
 * graça (mesmo motivo já anotado em `costs/periodoUsuario.ts`).
 */
function saoPauloOffsetMinutos(instante: Date): number {
  const partes = PARTES_FORMATTER.formatToParts(instante);
  const valor = (tipo: Intl.DateTimeFormatPartTypes) =>
    Number(partes.find((parte) => parte.type === tipo)?.value ?? "0");
  const comoUtc = Date.UTC(
    valor("year"),
    valor("month") - 1,
    valor("day"),
    valor("hour"),
    valor("minute"),
    valor("second"),
  );
  return Math.round((comoUtc - instante.getTime()) / 60_000);
}

/**
 * O instante em que o DIA OPERACIONAL vira — a próxima vez que
 * `diaOperacionalKey` passa a devolver outra chave. É o "quando o contador
 * zera" da tela: sem ele, "7 de 15 enviados" não diz se resta a noite
 * inteira ou dez minutos.
 *
 * Calculado sobre o relógio de São Paulo (mesmo fuso da chave), com o
 * deslocamento reconferido NO ALVO: mudança de fuso entre agora e a virada
 * deslocaria o instante em uma hora, e a segunda conta corrige isso.
 */
export function proximaViradaDiaOperacional(now: Date, inicioHora: number): Date {
  const hora = Math.min(23, Math.max(0, Math.trunc(inicioHora)));
  const offset = saoPauloOffsetMinutos(now);
  // Relógio de parede de São Paulo representado como se fosse UTC, só para
  // a aritmética de "hoje às H" / "amanhã às H".
  const parede = new Date(now.getTime() + offset * 60_000);
  const alvo = new Date(
    Date.UTC(parede.getUTCFullYear(), parede.getUTCMonth(), parede.getUTCDate(), hora),
  );
  if (alvo.getTime() <= parede.getTime()) alvo.setUTCDate(alvo.getUTCDate() + 1);

  const bruto = new Date(alvo.getTime() - offset * 60_000);
  const offsetNoAlvo = saoPauloOffsetMinutos(bruto);
  return offsetNoAlvo === offset ? bruto : new Date(alvo.getTime() - offsetNoAlvo * 60_000);
}

const UMA_HORA_MS = 60 * 60 * 1000;

export interface FilaContadorDoc {
  enviados: number;
  /** ISO de cada envio confirmado do dia — só as últimas 24h são mantidas. */
  envios: string[];
  ultimoEventoEm: string | null;
  /** Confirmações "falhou" do dia — ver `contadorComFalha`. */
  falhas: number;
  /** Confirmações "invalido" do dia — ver `contadorComInvalido`. */
  invalidos: number;
  /** Envios "enviado" do dia com `detalhe` não vazio (texto saiu, print não). */
  semPrint: number;
}

export interface FilaContadorSnapshot {
  /** Total de envios confirmados no dia operacional corrente. */
  totalDoDia: number;
  /** Quantos envios caem na última hora corrida a partir de `now`. */
  ultimaHora: number;
  /** Segundos desde o último evento registrado; `null` se nunca houve um. */
  segundosDesdeUltimoEvento: number | null;
}

/**
 * O doc completo do dia mais os dois derivados que `FilaContadorSnapshot`
 * também expõe (`ultimaHora`, `segundosDesdeUltimoEvento`) — o que
 * `GET /api/fila/resumo` precisa. Não estende `FilaContadorSnapshot`: aquele
 * usa `totalDoDia` para o mesmo número que aqui já é `enviados` (de
 * `FilaContadorDoc`), e duplicar o campo sob dois nomes confundiria mais do
 * que ajudaria.
 */
export interface FilaContadorCompleto extends FilaContadorDoc {
  ultimaHora: number;
  segundosDesdeUltimoEvento: number | null;
}

function numeroOuZero(valor: unknown): number {
  return typeof valor === "number" && Number.isFinite(valor) ? valor : 0;
}

function readContadorDoc(data: Record<string, unknown> | undefined): FilaContadorDoc {
  const enviados = numeroOuZero(data?.enviados);
  const envios = Array.isArray(data?.envios)
    ? data.envios.filter((iso): iso is string => typeof iso === "string")
    : [];
  const ultimoEventoEm = typeof data?.ultimoEventoEm === "string" ? data.ultimoEventoEm : null;
  return {
    enviados,
    envios,
    ultimoEventoEm,
    falhas: numeroOuZero(data?.falhas),
    invalidos: numeroOuZero(data?.invalidos),
    semPrint: numeroOuZero(data?.semPrint),
  };
}

/**
 * O doc do dia, LIDO, mais os dois derivados que dependem de `now`: envios na
 * última hora deslizante (usa `envios`, não `enviados` — é a janela de 1h que
 * precisa das marcas de tempo) e segundos desde o último evento (`null` =
 * ainda não houve nenhum). Doc ausente é o dia sem nenhum envio ainda — nunca
 * erro. Base tanto de `lerContadorFila` (o snapshot que os PORTÕES de ritmo
 * usam) quanto de `GET /api/fila/resumo` (que também precisa de `falhas`,
 * `invalidos`, `semPrint` e do `envios`/`ultimoEventoEm` brutos para calcular
 * QUANDO o teto/intervalo libera) — uma leitura só, nunca duas do mesmo doc.
 */
export async function lerContadorFilaCompleto(
  db: AppDb,
  now: Date,
  inicioDiaOperacionalHora: number,
): Promise<FilaContadorCompleto> {
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

  return { ...doc, ultimaHora, segundosDesdeUltimoEvento };
}

/**
 * Snapshot dos contadores da fila para um instante qualquer — só o que os
 * PORTÕES de ritmo (`motivoDeRitmo`) precisam. Casca fina sobre
 * `lerContadorFilaCompleto`, mantendo o formato de sempre (as três chaves,
 * `totalDoDia` em vez de `enviados`) para não mexer em quem já consome isto.
 */
export async function lerContadorFila(
  db: AppDb,
  now: Date,
  inicioDiaOperacionalHora: number,
): Promise<FilaContadorSnapshot> {
  const completo = await lerContadorFilaCompleto(db, now, inicioDiaOperacionalHora);
  return {
    totalDoDia: completo.enviados,
    ultimaHora: completo.ultimaHora,
    segundosDesdeUltimoEvento: completo.segundosDesdeUltimoEvento,
  };
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
  opcoes: { semPrint?: boolean } = {},
): FilaContadorDoc {
  const atual = readContadorDoc(data);
  const limite24h = now.getTime() - 24 * UMA_HORA_MS;
  const em = now.toISOString();
  const envios = atual.envios.filter((iso) => {
    const t = new Date(iso).getTime();
    return Number.isFinite(t) && t > limite24h;
  });
  return {
    ...atual,
    enviados: atual.enviados + 1,
    envios: [...envios, em],
    ultimoEventoEm: em,
    semPrint: atual.semPrint + (opcoes.semPrint ? 1 : 0),
  };
}

/**
 * O doc do contador depois de uma confirmação "falhou", puro — mesmo espírito
 * de `contadorComEnvio`. NÃO toca `envios`/`ultimoEventoEm`: uma tentativa que
 * falhou não é uma mensagem que saiu, e sujar a janela deslizante de 1h (ou o
 * relógio do intervalo mínimo) com ela faria os portões de RITMO pensarem que
 * acabou de sair uma mensagem quando não saiu nenhuma.
 */
export function contadorComFalha(data: Record<string, unknown> | undefined): FilaContadorDoc {
  const atual = readContadorDoc(data);
  return { ...atual, falhas: atual.falhas + 1 };
}

/**
 * O doc do contador depois de uma confirmação "invalido", puro — mesma razão
 * de `contadorComFalha` para não tocar `envios`/`ultimoEventoEm`: número sem
 * WhatsApp não é uma mensagem enviada.
 */
export function contadorComInvalido(data: Record<string, unknown> | undefined): FilaContadorDoc {
  const atual = readContadorDoc(data);
  return { ...atual, invalidos: atual.invalidos + 1 };
}

/**
 * Quando o portão `teto_hora` libera: o instante em que envios suficientes
 * saem da janela deslizante de 1h para `ultimaHora` cair abaixo de
 * `tetoPorHora` de novo. Não é "daqui a 1h" — se `tetoPorHora` caiu (edição no
 * meio do plantão) pode ser preciso mais de um envio sair da janela.
 * `undefined` só no caso degenerado (`tetoPorHora` ≤ 0 sem nenhum envio na
 * janela): não há envio nenhum cuja saída resolva, e mentir uma hora seria
 * pior que não dizer nenhuma.
 */
export function momentoFimTetoHora(
  doc: Pick<FilaContadorDoc, "envios">,
  tetoPorHora: number,
  now: Date,
): Date | undefined {
  const limiteHora = now.getTime() - UMA_HORA_MS;
  const naJanela = doc.envios
    .map((iso) => new Date(iso).getTime())
    .filter((t) => Number.isFinite(t) && t > limiteHora)
    .sort((a, b) => a - b);
  const excedente = naJanela.length - tetoPorHora + 1;
  if (excedente <= 0 || excedente > naJanela.length) return undefined;
  return new Date(naJanela[excedente - 1] + UMA_HORA_MS);
}

/** Quando o portão `intervalo` libera: `ultimoEventoEm + intervaloMinimoSegundos`. */
export function momentoFimIntervalo(
  doc: Pick<FilaContadorDoc, "ultimoEventoEm">,
  intervaloMinimoSegundos: number,
): Date | undefined {
  if (!doc.ultimoEventoEm) return undefined;
  const base = new Date(doc.ultimoEventoEm).getTime();
  if (!Number.isFinite(base)) return undefined;
  return new Date(base + intervaloMinimoSegundos * 1000);
}
