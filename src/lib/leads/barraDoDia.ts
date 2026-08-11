import type { FaixaHorario } from "@/lib/places/client";

import { formatHora, MIN_DIA, minutoDaSemanaLocal } from "./horarios";
import {
  faixasDoDia,
  familiaDasJanelas,
  minutoDoDia,
  utcOffsetDoLead,
  NIVEL_PADRAO,
  type FaixaNivelContato,
  type JanelasContatoConfig,
  type NivelContato,
} from "./janelaContato";
import type { Lead } from "./types";

/**
 * A BARRA DO DIA: os níveis da família (ver `./janelaContato.ts`) cruzados
 * com o horário de funcionamento REAL do lead, em hora LOCAL dele.
 * Determinístico e puro — `now` sempre vem de fora, nada aqui lê o relógio
 * nem toca Firestore.
 *
 * Duas regras que valem tanto para o cálculo quanto para quem desenha:
 *
 * 1. **Fora do funcionamento a barra não existe naquele trecho.** Vermelho
 *    quer dizer "aberto, mas hora ruim" — pintar de vermelho o que está
 *    fechado seria repetir com cor o que a ausência do trecho já diz.
 * 2. **Sem deslocamento UTC conhecido não há barra nenhuma** (`undefined`):
 *    melhor não mostrar hora do que mostrar a errada.
 */

const MIN_SEMANA = 7 * MIN_DIA;

/** Usado quando o lead não tem horário de funcionamento — sinalizado como estimativa. */
export const INTERVALO_COMERCIAL_PADRAO = { inicio: 9 * 60, fim: 18 * 60 };

export const ROTULO_NIVEL: Record<NivelContato, string> = {
  bom: "bom",
  razoavel: "razoável",
  ruim: "ruim",
};

interface Intervalo {
  inicio: number;
  fim: number;
}

export interface SegmentoBarra {
  /** Minuto do dia local do lead (0..1440). */
  inicioMin: number;
  fimMin: number;
  nivel: NivelContato;
}

export interface ProximoBom {
  /** 0 = hoje, 1 = amanhã… (dias à frente na hora local do lead). */
  offsetDias: number;
  /** "hoje" | "amanhã" | "quarta" */
  rotuloDia: string;
  /** Minuto do dia em que o próximo trecho bom começa (já recortado por agora e pelo funcionamento). */
  inicioMin: number;
}

export interface BarraDoDia {
  /** Deslocamento UTC (minutos) do lead usado neste cálculo — mesmo valor de `utcOffsetDoLead`. */
  offsetMinutos: number;
  /** 0=domingo…6=sábado, na hora local do lead. */
  diaSemana: number;
  /** Minuto do dia AGORA, hora local do lead — é onde vai o marcador. */
  minutoAgora: number;
  /**
   * Extremos do expediente de hoje (do primeiro abrir ao último fechar).
   * `undefined` = fechado o dia inteiro: não há barra a desenhar, só a
   * linha de texto.
   */
  abertura?: Intervalo;
  /** Trechos ABERTOS já classificados, em ordem. Buracos entre eles = fechado. */
  segmentos: SegmentoBarra[];
  /** Está aberto neste minuto? */
  aberto: boolean;
  /** Nível deste minuto — só existe quando aberto. */
  nivelAgora?: NivelContato;
  /** true = o lead não tem horário de funcionamento e a barra usa o intervalo comercial padrão. */
  estimado: boolean;
  /** Próximo trecho bom a partir de agora (até 7 dias à frente); ausente se agora já é bom, ou se não há. */
  proximoBom?: ProximoBom;
}

const NOME_DIA = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"] as const;

function unir(intervalos: Intervalo[]): Intervalo[] {
  const ordenados = [...intervalos].sort((a, b) => a.inicio - b.inicio);
  const saida: Intervalo[] = [];
  for (const atual of ordenados) {
    const ultimo = saida[saida.length - 1];
    if (ultimo && atual.inicio <= ultimo.fim) {
      ultimo.fim = Math.max(ultimo.fim, atual.fim);
    } else {
      saida.push({ ...atual });
    }
  }
  return saida;
}

/**
 * Trechos abertos de UM dia da semana, em minuto do dia (0..1440), já
 * unidos. Faixa que cruza a meia-noite entra recortada nos dois dias que
 * ela toca (mesma convenção de `horarios.ts`: fechar ≤ abrir = virou o
 * dia), por isso cada faixa é testada também deslocada de ±1 semana.
 */
function intervalosAbertosNoDia(faixas: FaixaHorario[], dia: number): Intervalo[] {
  const inicioDia = dia * MIN_DIA;
  const fimDia = inicioDia + MIN_DIA;
  const recortes: Intervalo[] = [];
  for (const faixa of faixas) {
    const abre = faixa.diaAbre * MIN_DIA + faixa.horaAbre * 60 + faixa.minAbre;
    const fechaBruto = faixa.diaFecha * MIN_DIA + faixa.horaFecha * 60 + faixa.minFecha;
    const fecha = fechaBruto <= abre ? fechaBruto + MIN_SEMANA : fechaBruto;
    for (const deslocamento of [-MIN_SEMANA, 0, MIN_SEMANA]) {
      const inicio = Math.max(abre + deslocamento, inicioDia);
      const fim = Math.min(fecha + deslocamento, fimDia);
      if (fim > inicio) recortes.push({ inicio: inicio - inicioDia, fim: fim - inicioDia });
    }
  }
  return unir(recortes);
}

/** Os trechos abertos de um dia + se vieram do intervalo comercial estimado. */
function aberturaDoDia(
  faixas: FaixaHorario[] | undefined,
  dia: number,
): { intervalos: Intervalo[]; estimado: boolean } {
  if (!faixas || faixas.length === 0) {
    return { intervalos: [{ ...INTERVALO_COMERCIAL_PADRAO }], estimado: true };
  }
  return { intervalos: intervalosAbertosNoDia(faixas, dia), estimado: false };
}

function nivelEm(minuto: number, faixas: FaixaNivelContato[]): NivelContato {
  const cobrindo = faixas.find(
    (faixa) => minuto >= minutoDoDia(faixa.inicio) && minuto < minutoDoDia(faixa.fim),
  );
  return cobrindo?.nivel ?? NIVEL_PADRAO;
}

/**
 * Recorta um trecho aberto nos pontos em que o nível muda. Trechos vizinhos
 * de mesmo nível saem fundidos — a barra desenha um retângulo por nível
 * contínuo, não um por faixa da config.
 */
function segmentar(aberto: Intervalo, faixas: FaixaNivelContato[]): SegmentoBarra[] {
  const cortes = new Set<number>([aberto.inicio, aberto.fim]);
  for (const faixa of faixas) {
    for (const ponto of [minutoDoDia(faixa.inicio), minutoDoDia(faixa.fim)]) {
      if (ponto > aberto.inicio && ponto < aberto.fim) cortes.add(ponto);
    }
  }
  const pontos = [...cortes].sort((a, b) => a - b);
  const saida: SegmentoBarra[] = [];
  for (let i = 0; i < pontos.length - 1; i++) {
    const inicioMin = pontos[i];
    const fimMin = pontos[i + 1];
    const nivel = nivelEm(inicioMin, faixas);
    const ultimo = saida[saida.length - 1];
    if (ultimo && ultimo.nivel === nivel && ultimo.fimMin === inicioMin) {
      ultimo.fimMin = fimMin;
    } else {
      saida.push({ inicioMin, fimMin, nivel });
    }
  }
  return saida;
}

function interseccao(a: Intervalo, b: Intervalo): Intervalo | undefined {
  const inicio = Math.max(a.inicio, b.inicio);
  const fim = Math.min(a.fim, b.fim);
  return fim > inicio ? { inicio, fim } : undefined;
}

/**
 * Próximo trecho BOM (nível `bom` da família ∩ funcionamento) que ainda não
 * terminou, varrendo de hoje até 7 dias à frente. Sem nenhum → undefined,
 * e a linha de texto simplesmente não promete nada.
 */
function acharProximoBom(
  janelas: JanelasContatoConfig,
  lead: Pick<Lead, "busca" | "horarios">,
  diaHoje: number,
  minutoAgora: number,
): ProximoBom | undefined {
  const familia = familiaDasJanelas(janelas, lead);
  if (!familia) return undefined;
  for (let offsetDias = 0; offsetDias <= 7; offsetDias++) {
    const dia = (diaHoje + offsetDias) % 7;
    const { intervalos } = aberturaDoDia(lead.horarios?.faixas, dia);
    const bons = faixasDoDia(familia, dia).filter((faixa) => faixa.nivel === "bom");
    const candidatos: Intervalo[] = [];
    for (const bom of bons) {
      for (const aberto of intervalos) {
        const trecho = interseccao(
          { inicio: minutoDoDia(bom.inicio), fim: minutoDoDia(bom.fim) },
          aberto,
        );
        if (trecho) candidatos.push(trecho);
      }
    }
    const limite = offsetDias === 0 ? minutoAgora : -1;
    const proximo = candidatos
      .sort((a, b) => a.inicio - b.inicio)
      .find((trecho) => trecho.fim > limite);
    if (proximo) {
      return {
        offsetDias,
        rotuloDia: offsetDias === 0 ? "hoje" : offsetDias === 1 ? "amanhã" : NOME_DIA[dia],
        inicioMin: Math.max(proximo.inicio, limite),
      };
    }
  }
  return undefined;
}

/**
 * A barra do dia do lead, ou `undefined` quando não dá pra saber a hora
 * local dele (sem `utcOffsetMinutes` do enriquecimento e sem país derivável
 * do endereço) — nesse caso quem chama não desenha barra nenhuma.
 */
export function barraDoDia(
  janelas: JanelasContatoConfig,
  lead: Pick<Lead, "busca" | "horarios" | "endereco">,
  now: Date = new Date(),
): BarraDoDia | undefined {
  const offset = utcOffsetDoLead(lead);
  if (offset === undefined) return undefined;
  const familia = familiaDasJanelas(janelas, lead);
  if (!familia) return undefined;

  const nowMin = minutoDaSemanaLocal(offset, now);
  const diaSemana = Math.floor(nowMin / MIN_DIA);
  const minutoAgora = nowMin - diaSemana * MIN_DIA;

  const { intervalos, estimado } = aberturaDoDia(lead.horarios?.faixas, diaSemana);
  const faixas = faixasDoDia(familia, diaSemana);
  const segmentos = intervalos.flatMap((aberto) => segmentar(aberto, faixas));
  const abertura =
    intervalos.length > 0
      ? { inicio: intervalos[0].inicio, fim: intervalos[intervalos.length - 1].fim }
      : undefined;

  const segmentoAgora = segmentos.find(
    (segmento) => minutoAgora >= segmento.inicioMin && minutoAgora < segmento.fimMin,
  );
  const proximoBom =
    segmentoAgora?.nivel === "bom"
      ? undefined
      : acharProximoBom(janelas, lead, diaSemana, minutoAgora);

  return {
    offsetMinutos: offset,
    diaSemana,
    minutoAgora,
    abertura,
    segmentos,
    aberto: segmentoAgora !== undefined,
    nivelAgora: segmentoAgora?.nivel,
    estimado,
    proximoBom,
  };
}

export function horaDoMinuto(minuto: number): string {
  return formatHora(Math.floor(minuto / 60) % 24, minuto % 60);
}

/**
 * Um minuto do dia do LEAD convertido para o minuto do dia equivalente no
 * fuso do USUÁRIO — mesmo instante real, duas leituras de relógio. Pura
 * aritmética de deslocamento: funciona igual em qualquer época do ano,
 * porque quem já resolveu o horário de verão é o `offsetMinutos` que cada
 * lado carrega (o do lead vem do enriquecimento; o do usuário, do fuso do
 * navegador NO INSTANTE `now` — ver `@/lib/fusoUsuario`).
 */
function minutoEquivalente(minutoLead: number, offsetLeadMinutos: number, offsetUsuarioMinutos: number): number {
  return (((minutoLead - offsetLeadMinutos + offsetUsuarioMinutos) % MIN_DIA) + MIN_DIA) % MIN_DIA;
}

/**
 * Um horário do lead pronto pra tela: só a hora dele quando o fuso do
 * usuário logado coincide com o dele (nunca repete o mesmo número duas
 * vezes), ou as DUAS horas — "19h em Zurique · 15h aqui" — deixando
 * explícito qual é qual, quando os fusos divergem. `nomeLead` é a cidade do
 * lead (ver `cidadeDoEndereco`); sem cidade reconhecível, cai no genérico
 * "lá".
 */
export function horaParaExibicao(
  minutoLead: number,
  offsetLeadMinutos: number,
  offsetUsuarioMinutos: number,
  nomeLead?: string,
): string {
  const horaLead = horaDoMinuto(minutoLead);
  if (offsetUsuarioMinutos === offsetLeadMinutos) return horaLead;
  const horaUsuario = horaDoMinuto(minutoEquivalente(minutoLead, offsetLeadMinutos, offsetUsuarioMinutos));
  const ladoLead = nomeLead ? `${horaLead} em ${nomeLead}` : `${horaLead} lá`;
  return `${ladoLead} · ${horaUsuario} aqui`;
}

/**
 * A linha curta abaixo da barra (e o texto equivalente em /hoje): estado
 * AGORA e próximo momento bom, em hora local do lead. É o canal de
 * informação que não depende de cor nenhuma — a barra diz a mesma coisa em
 * cor e altura, esta linha diz em palavras.
 *
 * `offsetUsuarioMinutos` é o deslocamento UTC de quem está logado AGORA
 * (padrão = o do próprio lead, ou seja, comportamento IDÊNTICO ao de antes
 * desta hora dupla existir — quem chama sem o segundo argumento nunca vê a
 * hora duplicada). Vindo diferente do lead, cada menção de hora nesta linha
 * — a de agora e a do próximo momento bom — ganha o par "hora do lead · hora
 * aqui" (ver `horaParaExibicao`); vindo igual, mostra só uma, sem repetir o
 * mesmo número duas vezes.
 */
export function linhaEstadoContato(
  barra: BarraDoDia,
  offsetUsuarioMinutos: number = barra.offsetMinutos,
  nomeLead?: string,
): string {
  const horaAgora = horaParaExibicao(barra.minutoAgora, barra.offsetMinutos, offsetUsuarioMinutos, nomeLead);
  const partes = [
    offsetUsuarioMinutos === barra.offsetMinutos ? `Hora do lead ${horaAgora}` : horaAgora,
  ];
  if (!barra.abertura) {
    partes.push("fechado hoje");
  } else if (!barra.aberto) {
    // Com intervalo estimado não dá pra afirmar "fechado" — o que se sabe é
    // que está fora do comercial que a estimativa assume.
    partes.push(barra.estimado ? "fora do horário comercial" : "fechado agora");
  } else {
    partes.push(`agora: ${ROTULO_NIVEL[barra.nivelAgora!]}`);
  }
  if (barra.proximoBom) {
    const horaProximo = horaParaExibicao(
      barra.proximoBom.inicioMin,
      barra.offsetMinutos,
      offsetUsuarioMinutos,
      nomeLead,
    );
    partes.push(`próximo bom ${barra.proximoBom.rotuloDia} ${horaProximo}`);
  }
  if (barra.estimado) partes.push("horário estimado");
  return partes.join(" · ");
}
