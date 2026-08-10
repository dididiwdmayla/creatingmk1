import { normalizaNicho } from "@/lib/precificacao/calc";
import type { FaixaHorario } from "@/lib/places/client";
import { utcOffsetDoPais } from "@/lib/utcOffsetPais";

import { cidadeDoEndereco } from "./cidade";
import { formatHora, MIN_DIA, minutoDaSemanaLocal } from "./horarios";
import type { Lead } from "./types";

/**
 * Janela recomendada de contato por FAMÍLIA de negócio (`/config`, sem
 * deploy) — puramente determinística, nada de IA gerando horário. Cada
 * família tem uma janela ideal e, opcionalmente, uma alternativa, mais a
 * prioridade de abordagem por dia da semana (0=domingo…6=sábado). A
 * recomendação NUNCA cai fora do horário de funcionamento já conhecido do
 * lead (`Lead.horarios`, SKU detailsProHours) — ver `linhaRecomendacaoContato`.
 */

export type PrioridadeDiaContato = "recomendado" | "poucoIndicado" | "indisponivel";

export const PRIORIDADES_DIA_CONTATO: readonly PrioridadeDiaContato[] = [
  "recomendado",
  "poucoIndicado",
  "indisponivel",
];

export interface HoraMinuto {
  hora: number;
  minuto: number;
}

export interface FaixaContato {
  inicio: HoraMinuto;
  fim: HoraMinuto;
}

export interface FamiliaJanelaContato {
  ideal: FaixaContato;
  /** Ausente = família só tem a janela ideal. */
  alternativa?: FaixaContato;
  /** 0=domingo…6=sábado. Dia sem entrada é tratado como "indisponivel". */
  dias: Record<number, PrioridadeDiaContato>;
}

/** Chave = família de negócio. Aberto (chave livre) para famílias além das conhecidas por padrão. */
export type JanelasContatoConfig = Record<string, FamiliaJanelaContato>;

/**
 * Famílias com janela própria por padrão — mesmos nichos das skins da Forja
 * de Demos (ver `SkinDefinition.nicho` em `lib/demos/registry.ts`), sem
 * importar o registro (que arrastaria os componentes React das skins pro
 * bundle de qualquer rota que carregue a config — ver o mesmo cuidado em
 * `lib/demos/capturas/ancoras.ts`).
 */
export const FAMILIAS_NICHO_CONTATO = [
  "barbearia",
  "lancheria",
  "tatuagem",
  "imobiliaria",
  "petshop",
  "multimarcas",
] as const;

/** Família de fallback — lead cujo nicho não bate com nenhuma família conhecida. */
export const FAMILIA_GENERICA = "generico";

/** Ordem de exibição no /config: famílias conhecidas + genérico por último. */
export const FAMILIAS_JANELA_CONTATO = [...FAMILIAS_NICHO_CONTATO, FAMILIA_GENERICA] as const;

const DIAS_UTEIS_PADRAO: Record<number, PrioridadeDiaContato> = {
  0: "indisponivel", // domingo
  1: "recomendado",
  2: "recomendado",
  3: "recomendado",
  4: "recomendado",
  5: "poucoIndicado", // sexta — menos indicada
  6: "indisponivel", // sábado
};

function faixa(horaInicio: number, minInicio: number, horaFim: number, minFim: number): FaixaContato {
  return { inicio: { hora: horaInicio, minuto: minInicio }, fim: { hora: horaFim, minuto: minFim } };
}

/**
 * Tabela padrão pedida: segunda a sexta valem abordagem (sexta menos
 * indicada), fim de semana desmarcado. Só imobiliária e genérico têm
 * alternativa — as demais famílias operam só com a janela ideal.
 */
export const DEFAULT_JANELAS_CONTATO: JanelasContatoConfig = {
  barbearia: { ideal: faixa(9, 30, 11, 0), dias: { ...DIAS_UTEIS_PADRAO } },
  lancheria: { ideal: faixa(14, 0, 16, 0), dias: { ...DIAS_UTEIS_PADRAO } },
  tatuagem: { ideal: faixa(10, 0, 12, 0), dias: { ...DIAS_UTEIS_PADRAO } },
  imobiliaria: {
    ideal: faixa(9, 30, 11, 0),
    alternativa: faixa(16, 0, 17, 0),
    dias: { ...DIAS_UTEIS_PADRAO },
  },
  petshop: { ideal: faixa(14, 0, 16, 0), dias: { ...DIAS_UTEIS_PADRAO } },
  multimarcas: { ideal: faixa(14, 0, 16, 0), dias: { ...DIAS_UTEIS_PADRAO } },
  [FAMILIA_GENERICA]: {
    ideal: faixa(9, 30, 11, 0),
    alternativa: faixa(16, 0, 17, 0),
    dias: { ...DIAS_UTEIS_PADRAO },
  },
};

/**
 * Família de negócio do lead: o nicho da busca que o trouxe (`lead.busca.nicho`,
 * texto livre digitado na busca), normalizado e casado por substring contra
 * as famílias conhecidas — mesmo espírito determinístico de
 * `multiplicadorParaNicho` (precificação regional). Sem busca, ou nicho que
 * não bate com nenhuma família → `FAMILIA_GENERICA`.
 */
export function familiaDoLead(lead: Pick<Lead, "busca">): string {
  const nicho = lead.busca?.nicho;
  if (!nicho) return FAMILIA_GENERICA;
  const normalizado = normalizaNicho(nicho);
  const encontrada = FAMILIAS_NICHO_CONTATO.find((familia) => normalizado.includes(familia));
  return encontrada ?? FAMILIA_GENERICA;
}

/**
 * Deslocamento UTC do lead: `horarios.utcOffsetMinutes` do enriquecimento
 * (SKU detailsProHours) vence; sem ele, deriva do PAÍS do endereço quando
 * reconhecível; sem nenhum dos dois, undefined — o chamador não mostra hora
 * nenhuma em vez de arriscar mostrar uma errada.
 */
export function utcOffsetDoLead(lead: Pick<Lead, "horarios" | "endereco">): number | undefined {
  if (lead.horarios?.utcOffsetMinutes !== undefined) return lead.horarios.utcOffsetMinutes;
  if (!lead.endereco) return undefined;
  return utcOffsetDoPais(cidadeDoEndereco(lead.endereco).pais);
}

/**
 * Hora local do lead AGORA (`now`), no formato do registro de disparo (ver
 * `RegistroEnvioContato`) — usada pelo repositório no momento do clique no
 * WhatsApp, não pela recomendação de janela (que usa `minutoDaSemanaLocal`
 * direto). Sem deslocamento UTC conhecido → objeto vazio (nenhum dos dois
 * campos), mesmo critério de `linhaRecomendacaoContato`.
 */
export function horarioLocalNoDisparo(
  lead: Pick<Lead, "horarios" | "endereco">,
  now: Date = new Date(),
): { horaLocalLead?: string; diaSemanaLocalLead?: number } {
  const offset = utcOffsetDoLead(lead);
  if (offset === undefined) return {};
  const nowMin = minutoDaSemanaLocal(offset, now);
  const diaSemanaLocalLead = Math.floor(nowMin / MIN_DIA);
  const minutoDoDia = nowMin - diaSemanaLocalLead * MIN_DIA;
  const horaLocalLead = `${String(Math.floor(minutoDoDia / 60)).padStart(2, "0")}:${String(minutoDoDia % 60).padStart(2, "0")}`;
  return { horaLocalLead, diaSemanaLocalLead };
}

interface Intervalo {
  inicio: number;
  fim: number;
}

function intersecaoIntervalos(a: Intervalo, b: Intervalo): Intervalo | undefined {
  const inicio = Math.max(a.inicio, b.inicio);
  const fim = Math.min(a.fim, b.fim);
  return fim > inicio ? { inicio, fim } : undefined;
}

/** Faixa de abertura normalizada em minuto-da-semana, cruzando a semana quando fecha ≤ abre (mesma convenção de horarios.ts). */
function normalizarAbertura(faixaAbertura: FaixaHorario): Intervalo {
  const inicio = faixaAbertura.diaAbre * MIN_DIA + faixaAbertura.horaAbre * 60 + faixaAbertura.minAbre;
  const fimBruto = faixaAbertura.diaFecha * MIN_DIA + faixaAbertura.horaFecha * 60 + faixaAbertura.minFecha;
  const MIN_SEMANA = 7 * MIN_DIA;
  return { inicio, fim: fimBruto <= inicio ? fimBruto + MIN_SEMANA : fimBruto };
}

/**
 * Maior interseção entre o candidato (janela de família num dia específico,
 * em minuto-da-semana) e o horário de funcionamento — testa cada faixa de
 * abertura na semana do candidato e nas semanas vizinhas (faixa que cruza a
 * virada da semana), e fica com a interseção mais longa (empate: a que
 * começa antes). Sem interseção nenhuma → undefined.
 */
function intersecaoComAbertura(candidato: Intervalo, faixasAbertura: FaixaHorario[]): Intervalo | undefined {
  const MIN_SEMANA = 7 * MIN_DIA;
  let melhor: Intervalo | undefined;
  for (const faixaAbertura of faixasAbertura) {
    const normalizada = normalizarAbertura(faixaAbertura);
    for (const deslocamento of [-MIN_SEMANA, 0, MIN_SEMANA]) {
      const deslocada = { inicio: normalizada.inicio + deslocamento, fim: normalizada.fim + deslocamento };
      const resultado = intersecaoIntervalos(candidato, deslocada);
      if (!resultado) continue;
      const duracao = resultado.fim - resultado.inicio;
      const duracaoMelhor = melhor ? melhor.fim - melhor.inicio : -1;
      if (duracao > duracaoMelhor || (duracao === duracaoMelhor && melhor && resultado.inicio < melhor.inicio)) {
        melhor = resultado;
      }
    }
  }
  return melhor;
}

const NOME_DIA: Record<number, string> = {
  0: "Domingo",
  1: "Segunda",
  2: "Terça",
  3: "Quarta",
  4: "Quinta",
  5: "Sexta",
  6: "Sábado",
};

function rotuloDia(offsetDias: number, diaAlvo: number): string {
  if (offsetDias === 0) return "Hoje";
  if (offsetDias === 1) return "Amanhã";
  return NOME_DIA[diaAlvo];
}

function candidatosDoDia(familia: FamiliaJanelaContato): FaixaContato[] {
  const candidatos = [familia.ideal, ...(familia.alternativa ? [familia.alternativa] : [])];
  return candidatos.sort(
    (a, b) => a.inicio.hora * 60 + a.inicio.minuto - (b.inicio.hora * 60 + b.inicio.minuto),
  );
}

/**
 * Linha curta e determinística com a janela recomendada da família em hora
 * LOCAL do lead: a janela ideal (ou alternativa) de hoje que ainda não
 * passou, ou — se todas as de hoje já passaram — a próxima nos dias
 * seguintes em que vale abordar (config `dias`). Cruza com
 * `lead.horarios.faixas` (horário de funcionamento já conhecido): mostra a
 * INTERSEÇÃO quando existe; sem interseção (mas com horário declarado),
 * mostra a janela da família sinalizando o descompasso. Sem
 * `lead.horarios` (nunca buscado), mostra a janela da família como está.
 *
 * Sem deslocamento UTC conhecido (nem enriquecimento, nem país derivável do
 * endereço) → undefined: melhor não mostrar hora nenhuma do que uma errada.
 * Config sem NENHUM dia disponível para a família → também undefined.
 */
export function linhaRecomendacaoContato(
  janelas: JanelasContatoConfig,
  lead: Pick<Lead, "busca" | "horarios" | "endereco">,
  now: Date = new Date(),
): string | undefined {
  const offset = utcOffsetDoLead(lead);
  if (offset === undefined) return undefined;

  const familiaId = familiaDoLead(lead);
  const familia = janelas[familiaId] ?? janelas[FAMILIA_GENERICA];
  if (!familia) return undefined;

  const nowMin = minutoDaSemanaLocal(offset, now);
  const diaHoje = Math.floor(nowMin / MIN_DIA);
  const minutoDoDia = nowMin - diaHoje * MIN_DIA;
  const faixasAbertura = lead.horarios?.faixas;

  for (let offsetDias = 0; offsetDias <= 7; offsetDias++) {
    const diaAlvo = (diaHoje + offsetDias) % 7;
    const prioridade = familia.dias[diaAlvo] ?? "indisponivel";
    if (prioridade === "indisponivel") continue;

    for (const candidato of candidatosDoDia(familia)) {
      const inicioMin = candidato.inicio.hora * 60 + candidato.inicio.minuto;
      const fimMin = candidato.fim.hora * 60 + candidato.fim.minuto;
      const fimRelativoAgora = offsetDias * MIN_DIA + fimMin - minutoDoDia;
      if (fimRelativoAgora <= 0) continue; // já passou

      const intervaloCandidato: Intervalo = { inicio: diaAlvo * MIN_DIA + inicioMin, fim: diaAlvo * MIN_DIA + fimMin };
      const intersecao = faixasAbertura ? intersecaoComAbertura(intervaloCandidato, faixasAbertura) : undefined;
      const conflita = faixasAbertura !== undefined && faixasAbertura.length > 0 && intersecao === undefined;
      const exibido = intersecao
        ? { inicio: intersecao.inicio - diaAlvo * MIN_DIA, fim: intersecao.fim - diaAlvo * MIN_DIA }
        : { inicio: inicioMin, fim: fimMin };

      const rotulo = rotuloDia(offsetDias, diaAlvo);
      const de = formatHora(Math.floor(exibido.inicio / 60), exibido.inicio % 60);
      const ate = formatHora(Math.floor(exibido.fim / 60), exibido.fim % 60);
      const base = `${rotulo}: ${de}–${ate}`;
      return conflita ? `${base} (fora do horário do estabelecimento)` : base;
    }
  }

  return undefined;
}

/**
 * Valida o pedaço `janelasContato` de um patch de config — mesmo padrão de
 * `validarAncoras` (lib/demos/capturas/ancoras.ts): chave desconhecida,
 * horário inválido ou faixa invertida são ERRO, não silêncio.
 */
export function validarJanelasContato(valor: unknown, caminho: string, problemas: string[]): void {
  if (typeof valor !== "object" || valor === null || Array.isArray(valor)) {
    problemas.push(`${caminho} deve ser um objeto família → janela`);
    return;
  }

  for (const [familiaId, entrada] of Object.entries(valor as Record<string, unknown>)) {
    const base = `${caminho}.${familiaId}`;
    if (typeof entrada !== "object" || entrada === null || Array.isArray(entrada)) {
      problemas.push(`${base} deve ser um objeto`);
      continue;
    }
    const { ideal, alternativa, dias } = entrada as Record<string, unknown>;
    validarFaixaContato(ideal, `${base}.ideal`, problemas, { obrigatoria: true });
    if (alternativa !== undefined) {
      validarFaixaContato(alternativa, `${base}.alternativa`, problemas, { obrigatoria: false });
    }
    validarDiasContato(dias, `${base}.dias`, problemas);
  }
}

function validarHoraMinuto(valor: unknown, caminho: string, problemas: string[]): void {
  if (typeof valor !== "object" || valor === null) {
    problemas.push(`${caminho} deve ser um objeto { hora, minuto }`);
    return;
  }
  const { hora, minuto } = valor as Record<string, unknown>;
  if (typeof hora !== "number" || !Number.isInteger(hora) || hora < 0 || hora > 23) {
    problemas.push(`${caminho}.hora deve ser inteiro entre 0 e 23`);
  }
  if (typeof minuto !== "number" || !Number.isInteger(minuto) || minuto < 0 || minuto > 59) {
    problemas.push(`${caminho}.minuto deve ser inteiro entre 0 e 59`);
  }
}

function validarFaixaContato(
  valor: unknown,
  caminho: string,
  problemas: string[],
  { obrigatoria }: { obrigatoria: boolean },
): void {
  if (valor === undefined) {
    if (obrigatoria) problemas.push(`${caminho} é obrigatória`);
    return;
  }
  if (typeof valor !== "object" || valor === null) {
    problemas.push(`${caminho} deve ser um objeto { inicio, fim }`);
    return;
  }
  const { inicio, fim } = valor as Record<string, unknown>;
  validarHoraMinuto(inicio, `${caminho}.inicio`, problemas);
  validarHoraMinuto(fim, `${caminho}.fim`, problemas);
  if (isHoraMinuto(inicio) && isHoraMinuto(fim)) {
    const inicioMin = inicio.hora * 60 + inicio.minuto;
    const fimMin = fim.hora * 60 + fim.minuto;
    if (fimMin <= inicioMin) {
      problemas.push(`${caminho}: fim deve ser depois do início`);
    }
  }
}

function isHoraMinuto(valor: unknown): valor is HoraMinuto {
  if (typeof valor !== "object" || valor === null) return false;
  const { hora, minuto } = valor as Record<string, unknown>;
  return (
    typeof hora === "number" &&
    Number.isInteger(hora) &&
    hora >= 0 &&
    hora <= 23 &&
    typeof minuto === "number" &&
    Number.isInteger(minuto) &&
    minuto >= 0 &&
    minuto <= 59
  );
}

function validarDiasContato(valor: unknown, caminho: string, problemas: string[]): void {
  if (typeof valor !== "object" || valor === null || Array.isArray(valor)) {
    problemas.push(`${caminho} deve ser um objeto dia (0-6) → prioridade`);
    return;
  }
  for (const [diaChave, prioridade] of Object.entries(valor as Record<string, unknown>)) {
    const dia = Number(diaChave);
    if (!Number.isInteger(dia) || dia < 0 || dia > 6) {
      problemas.push(`${caminho}.${diaChave} não é um dia válido (0-6)`);
      continue;
    }
    if (!PRIORIDADES_DIA_CONTATO.includes(prioridade as PrioridadeDiaContato)) {
      problemas.push(`${caminho}.${diaChave} deve ser um de: ${PRIORIDADES_DIA_CONTATO.join(", ")}`);
    }
  }
}
