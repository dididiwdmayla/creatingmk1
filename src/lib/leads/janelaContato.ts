import { normalizaNicho } from "@/lib/precificacao/calc";
import { utcOffsetDoPais } from "@/lib/utcOffsetPais";

import { cidadeDoEndereco } from "./cidade";
import { MIN_DIA, minutoDaSemanaLocal } from "./horarios";
import type { Lead } from "./types";

/**
 * FAIXAS DE NÍVEL ao longo do dia, por família de negócio e por dia da
 * semana (`/config`, sem deploy) — puramente determinístico, nada de IA
 * gerando horário. Três níveis e só três: `bom`, `razoavel`, `ruim`.
 *
 * A tabela só guarda o que foi MARCADO: minuto aberto sem faixa nenhuma
 * cobrindo cai em `razoavel` (`NIVEL_PADRAO`). É isso que faz "fim de
 * semana desmarcado" ser representável sem inventar um quarto nível — um
 * dia com lista vazia é um dia sobre o qual a tabela não opina, não um dia
 * proibido.
 *
 * Quem desenha a barra do dia (interseção com o horário de funcionamento
 * real do lead, marcador de agora, próximo momento bom) é
 * `./barraDoDia.ts`; aqui ficam só o modelo, os padrões e a validação.
 */

export type NivelContato = "bom" | "razoavel" | "ruim";

export const NIVEIS_CONTATO: readonly NivelContato[] = ["bom", "razoavel", "ruim"];

/** Nível de um minuto ABERTO que nenhuma faixa da família cobre. */
export const NIVEL_PADRAO: NivelContato = "razoavel";

export interface HoraMinuto {
  hora: number;
  minuto: number;
}

/** Um trecho do dia (hora local do lead) com o nível de abordagem dele. */
export interface FaixaNivelContato {
  inicio: HoraMinuto;
  fim: HoraMinuto;
  nivel: NivelContato;
}

export interface FamiliaJanelaContato {
  /**
   * 0=domingo…6=sábado → faixas daquele dia, sem sobreposição. Dia com
   * lista vazia = desmarcado (tudo que estiver aberto vale `NIVEL_PADRAO`).
   */
  dias: Record<number, FaixaNivelContato[]>;
}

/** Chave = família de negócio. Aberto (chave livre) para famílias além das conhecidas por padrão. */
export type JanelasContatoConfig = Record<string, FamiliaJanelaContato>;

/**
 * Famílias com faixas próprias por padrão — mesmos nichos das skins da
 * Forja de Demos (ver `SkinDefinition.nicho` em `lib/demos/registry.ts`),
 * sem importar o registro (que arrastaria os componentes React das skins
 * pro bundle de qualquer rota que carregue a config — ver o mesmo cuidado
 * em `lib/demos/capturas/ancoras.ts`).
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

export const DIAS_SEMANA = [0, 1, 2, 3, 4, 5, 6] as const;

export function minutoDoDia({ hora, minuto }: HoraMinuto): number {
  return hora * 60 + minuto;
}

export function horaMinuto(minutoDoDia: number): HoraMinuto {
  return { hora: Math.floor(minutoDoDia / 60), minuto: minutoDoDia % 60 };
}

/** Faixas de um dia (0=domingo…6=sábado), ordenadas por início. Dia sem entrada = lista vazia. */
export function faixasDoDia(familia: FamiliaJanelaContato, dia: number): FaixaNivelContato[] {
  return [...(familia.dias[dia] ?? [])].sort((a, b) => minutoDoDia(a.inicio) - minutoDoDia(b.inicio));
}

function faixa(
  horaInicio: number,
  minInicio: number,
  horaFim: number,
  minFim: number,
  nivel: NivelContato,
): FaixaNivelContato {
  return {
    inicio: { hora: horaInicio, minuto: minInicio },
    fim: { hora: horaFim, minuto: minFim },
    nivel,
  };
}

/**
 * Sexta vale menos que segunda-quinta: o padrão do dia útil com todo `bom`
 * rebaixado a `razoavel`. `ruim` continua `ruim` — sexta é dia sem hora
 * privilegiada, não dia ruim inteiro.
 */
function rebaixarSexta(uteis: FaixaNivelContato[]): FaixaNivelContato[] {
  return uteis.map((f) => (f.nivel === "bom" ? { ...f, nivel: "razoavel" as const } : { ...f }));
}

/**
 * Monta os 7 dias a partir do padrão de segunda a quinta. Sexta sai
 * rebaixada (ver `rebaixarSexta`) e o fim de semana sai DESMARCADO, salvo
 * quando a família passa um sábado/domingo próprio — a barbearia é o caso:
 * sábado é o movimento dela, não hora de abordar.
 */
function semana({
  uteis,
  sexta = rebaixarSexta(uteis),
  sabado = [],
  domingo = [],
}: {
  uteis: FaixaNivelContato[];
  sexta?: FaixaNivelContato[];
  sabado?: FaixaNivelContato[];
  domingo?: FaixaNivelContato[];
}): Record<number, FaixaNivelContato[]> {
  return { 0: domingo, 1: uteis, 2: uteis, 3: uteis, 4: uteis, 5: sexta, 6: sabado };
}

/**
 * Tabela padrão, por família: só o que é opinião (bom/ruim); o resto do
 * expediente cai em `razoavel` sozinho. Tudo editável em /config.
 */
export const DEFAULT_JANELAS_CONTATO: JanelasContatoConfig = {
  // Manhã livre; fim de tarde é o pico da cadeira, e sábado é o dia inteiro.
  barbearia: {
    dias: semana({
      uteis: [faixa(9, 0, 11, 30, "bom"), faixa(16, 30, 20, 0, "ruim")],
      sabado: [faixa(9, 0, 20, 0, "ruim")],
    }),
  },
  // Almoço e janta são serviço na chapa; o meio da tarde é o respiro.
  lancheria: {
    dias: semana({
      uteis: [
        faixa(11, 30, 14, 0, "ruim"),
        faixa(14, 30, 16, 30, "bom"),
        faixa(18, 30, 21, 0, "ruim"),
      ],
    }),
  },
  // Estúdio abre tarde; o começo da tarde é antes da sessão longa.
  tatuagem: { dias: semana({ uteis: [faixa(13, 0, 15, 0, "bom")] }) },
  // Corretor está na rua nas pontas do dia; meados de manhã e meio de tarde é escritório.
  imobiliaria: {
    dias: semana({ uteis: [faixa(9, 30, 11, 0, "bom"), faixa(14, 30, 16, 30, "bom")] }),
  },
  petshop: { dias: semana({ uteis: [faixa(14, 0, 16, 30, "bom")] }) },
  multimarcas: { dias: semana({ uteis: [faixa(14, 0, 16, 30, "bom")] }) },
  [FAMILIA_GENERICA]: {
    dias: semana({ uteis: [faixa(9, 30, 11, 0, "bom"), faixa(14, 30, 16, 30, "bom")] }),
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

/** Família configurada do lead, com o genérico como rede — undefined só se nem o genérico existir. */
export function familiaDasJanelas(
  janelas: JanelasContatoConfig,
  lead: Pick<Lead, "busca">,
): FamiliaJanelaContato | undefined {
  return janelas[familiaDoLead(lead)] ?? janelas[FAMILIA_GENERICA];
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
 * WhatsApp. Continua existindo depois da troca da recomendação pela barra
 * do dia: é o registro que vai permitir comparar taxa de resposta POR
 * FAIXA mais adiante. Sem deslocamento UTC conhecido → objeto vazio
 * (nenhum dos dois campos), mesmo critério da barra.
 */
export function horarioLocalNoDisparo(
  lead: Pick<Lead, "horarios" | "endereco">,
  now: Date = new Date(),
): { horaLocalLead?: string; diaSemanaLocalLead?: number } {
  const offset = utcOffsetDoLead(lead);
  if (offset === undefined) return {};
  const nowMin = minutoDaSemanaLocal(offset, now);
  const diaSemanaLocalLead = Math.floor(nowMin / MIN_DIA);
  const minuto = nowMin - diaSemanaLocalLead * MIN_DIA;
  const horaLocalLead = `${String(Math.floor(minuto / 60)).padStart(2, "0")}:${String(minuto % 60).padStart(2, "0")}`;
  return { horaLocalLead, diaSemanaLocalLead };
}

/**
 * Valida o pedaço `janelasContato` de um patch de config — mesmo padrão de
 * `validarAncoras` (lib/demos/capturas/ancoras.ts): chave desconhecida,
 * horário inválido, faixa invertida ou faixas sobrepostas no mesmo dia são
 * ERRO, não silêncio.
 */
export function validarJanelasContato(valor: unknown, caminho: string, problemas: string[]): void {
  if (typeof valor !== "object" || valor === null || Array.isArray(valor)) {
    problemas.push(`${caminho} deve ser um objeto família → faixas por dia`);
    return;
  }

  for (const [familiaId, entrada] of Object.entries(valor as Record<string, unknown>)) {
    validarFamiliaContato(entrada, `${caminho}.${familiaId}`, problemas);
  }
}

function validarFamiliaContato(valor: unknown, caminho: string, problemas: string[]): void {
  if (typeof valor !== "object" || valor === null || Array.isArray(valor)) {
    problemas.push(`${caminho} deve ser um objeto { dias }`);
    return;
  }
  for (const chave of Object.keys(valor as Record<string, unknown>)) {
    if (chave !== "dias") problemas.push(`${caminho}.${chave} não é um campo conhecido`);
  }
  const { dias } = valor as Record<string, unknown>;
  if (typeof dias !== "object" || dias === null || Array.isArray(dias)) {
    problemas.push(`${caminho}.dias deve ser um objeto dia (0-6) → faixas`);
    return;
  }
  for (const [diaChave, lista] of Object.entries(dias as Record<string, unknown>)) {
    const dia = Number(diaChave);
    const base = `${caminho}.dias.${diaChave}`;
    if (!Number.isInteger(dia) || dia < 0 || dia > 6) {
      problemas.push(`${base} não é um dia válido (0-6)`);
      continue;
    }
    if (!Array.isArray(lista)) {
      problemas.push(`${base} deve ser uma lista de faixas`);
      continue;
    }
    lista.forEach((item, i) => validarFaixaNivel(item, `${base}[${i}]`, problemas));
    validarSemSobreposicao(lista, base, problemas);
  }
}

function validarFaixaNivel(valor: unknown, caminho: string, problemas: string[]): void {
  if (typeof valor !== "object" || valor === null || Array.isArray(valor)) {
    problemas.push(`${caminho} deve ser um objeto { inicio, fim, nivel }`);
    return;
  }
  const { inicio, fim, nivel } = valor as Record<string, unknown>;
  validarHoraMinuto(inicio, `${caminho}.inicio`, problemas);
  validarHoraMinuto(fim, `${caminho}.fim`, problemas);
  if (!NIVEIS_CONTATO.includes(nivel as NivelContato)) {
    problemas.push(`${caminho}.nivel deve ser um de: ${NIVEIS_CONTATO.join(", ")}`);
  }
  if (isHoraMinuto(inicio) && isHoraMinuto(fim) && minutoDoDia(fim) <= minutoDoDia(inicio)) {
    problemas.push(`${caminho}: fim deve ser depois do início`);
  }
}

/**
 * Faixas do mesmo dia não podem se sobrepor: com sobreposição, "qual nível
 * vale às 15h" passaria a depender da ordem da lista — e a barra deixaria
 * de ser determinística.
 */
function validarSemSobreposicao(lista: unknown[], caminho: string, problemas: string[]): void {
  const validas = lista.filter(
    (item): item is FaixaNivelContato =>
      typeof item === "object" &&
      item !== null &&
      isHoraMinuto((item as FaixaNivelContato).inicio) &&
      isHoraMinuto((item as FaixaNivelContato).fim),
  );
  const ordenadas = [...validas].sort((a, b) => minutoDoDia(a.inicio) - minutoDoDia(b.inicio));
  for (let i = 1; i < ordenadas.length; i++) {
    if (minutoDoDia(ordenadas[i].inicio) < minutoDoDia(ordenadas[i - 1].fim)) {
      problemas.push(`${caminho}: faixas sobrepostas no mesmo dia`);
      return;
    }
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

/**
 * Mescla POR FAMÍLIA a tabela persistida sobre a padrão, DESCARTANDO
 * família que não bate com o modelo atual. O doc `/config/app` gravado
 * antes desta troca guarda o formato antigo (janela ideal/alternativa +
 * prioridade por dia); sem esta peneira ele substituiria a família inteira
 * por um objeto que a barra não sabe ler — e a ficha do lead ficaria sem
 * barra até alguém reabrir /config e salvar. Formato velho = cai no
 * padrão novo, que é exatamente o que ele deveria virar.
 */
export function mesclarJanelasContato(
  base: JanelasContatoConfig,
  persistido: unknown,
): JanelasContatoConfig {
  if (typeof persistido !== "object" || persistido === null || Array.isArray(persistido)) {
    return { ...base };
  }
  const saida: JanelasContatoConfig = { ...base };
  for (const [familiaId, entrada] of Object.entries(persistido as Record<string, unknown>)) {
    const problemas: string[] = [];
    validarFamiliaContato(entrada, familiaId, problemas);
    if (problemas.length === 0) saida[familiaId] = entrada as FamiliaJanelaContato;
  }
  return saida;
}
