import type { AgendaFila, BarradoAgenda, LinhaAgenda, VencidoAgenda } from "./estado";

/**
 * Os TEXTOS da agenda da fila (`AgendaFilaBloco`, painel "Fila de envio") —
 * puros e client-safe, para a tela e o teste lerem a mesma frase.
 *
 * Toda hora sai no fuso do OPERADOR, America/Sao_Paulo, FIXO — não no do
 * navegador: quem decide o dia operacional e a meta é o relógio de São
 * Paulo, e a agenda inteira é sobre ele. A hora do lead aparece ao lado só
 * quando é OUTRA.
 */
const FUSO_OPERADOR = "America/Sao_Paulo";

const HORA_OPERADOR = new Intl.DateTimeFormat("pt-BR", {
  timeZone: FUSO_OPERADOR,
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

const CHAVE_DIA_OPERADOR = new Intl.DateTimeFormat("en-CA", {
  timeZone: FUSO_OPERADOR,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const SEMANA_OPERADOR = new Intl.DateTimeFormat("pt-BR", { timeZone: FUSO_OPERADOR, weekday: "short" });
const DATA_OPERADOR = new Intl.DateTimeFormat("pt-BR", { timeZone: FUSO_OPERADOR, day: "2-digit", month: "2-digit" });

const DIA_MS = 24 * 60 * 60 * 1000;

/** "09:00" — a hora do instante no relógio do operador. */
export function horaDoOperador(iso: string): string {
  return HORA_OPERADOR.format(new Date(iso));
}

function diasEntre(iso: string, referenciaIso: string): number {
  const dia = (valor: string) => Date.parse(`${CHAVE_DIA_OPERADOR.format(new Date(valor))}T00:00:00Z`);
  return Math.round((dia(iso) - dia(referenciaIso)) / DIA_MS);
}

/**
 * O dia do instante, relativo a `referenciaIso` (o instante da simulação,
 * nunca `Date.now()` no render): "hoje", "amanhã", ou "qua 11/03".
 */
export function diaDoOperador(iso: string, referenciaIso: string): string {
  const dias = diasEntre(iso, referenciaIso);
  if (dias === 0) return "hoje";
  if (dias === 1) return "amanhã";
  const data = new Date(iso);
  return `${SEMANA_OPERADOR.format(data).replace(".", "")} ${DATA_OPERADOR.format(data)}`;
}

/** "13:00" — a hora do instante no fuso do LEAD (deslocamento em minutos). */
export function horaNoFusoDoLead(iso: string, offsetMinutos: number): string {
  const local = new Date(new Date(iso).getTime() + offsetMinutos * 60_000);
  return `${String(local.getUTCHours()).padStart(2, "0")}:${String(local.getUTCMinutes()).padStart(2, "0")}`;
}

/**
 * "13:00 em Lisboa" — a hora DELE quando o relógio dele marca outra coisa
 * no mesmo instante; `undefined` quando o fuso coincide (nunca a mesma hora
 * repetida). Sem cidade reconhecível, "lá".
 */
export function horaDoLeadSeOutra(linha: Pick<LinhaAgenda, "em" | "offsetLead" | "cidade">): string | undefined {
  const dele = horaNoFusoDoLead(linha.em, linha.offsetLead);
  if (dele === horaDoOperador(linha.em)) return undefined;
  return `${dele} ${linha.cidade ? `em ${linha.cidade}` : "lá"}`;
}

/**
 * O complemento de fuso da linha: a hora dele quando é outra — MENOS quando
 * o motivo é a janela, que já diz a hora dele ("abre às 10:13 em Lisboa"):
 * repetir "· 10:13 em Lisboa" ao lado seria a mesma hora duas vezes.
 */
export function complementoDeFuso(
  linha: Pick<LinhaAgenda, "em" | "offsetLead" | "cidade" | "motivo">,
): string | undefined {
  return linha.motivo === "janela" ? undefined : horaDoLeadSeOutra(linha);
}

/** "10 min" / "90 s" — o intervalo mínimo como a tela o diz. */
function duracao(segundos: number): string {
  return segundos % 60 === 0 ? `${segundos / 60} min` : `${segundos} s`;
}

/**
 * O motivo do horário, em poucas palavras — o último portão que segurou a
 * fila antes da linha (ver `MotivoHorarioAgenda`), com o número da regra.
 */
export function textoDoMotivo(linha: LinhaAgenda, ritmo: AgendaFila["ritmo"]): string {
  let texto: string;
  switch (linha.motivo) {
    case "agora":
      texto = "já pode sair";
      break;
    case "em_seguida":
      texto = "logo depois do anterior";
      break;
    case "janela":
      // Em outro fuso, a hora DELE com o lugar — é a hora em que a faixa
      // dele abre; a do operador já está na coluna da esquerda.
      texto = `abre às ${horaDoLeadSeOutra(linha) ?? horaNoFusoDoLead(linha.em, linha.offsetLead)}`;
      break;
    case "intervalo":
      texto = `intervalo de ${duracao(ritmo.intervaloMinimoSegundos)}`;
      break;
    case "teto_hora":
      texto = `teto de ${ritmo.tetoPorHora} por hora`;
      break;
    case "meta":
      return `meta de ${ritmo.metaDiaria} batida · dia novo`;
  }
  return linha.depoisDaMeta ? `meta de ${ritmo.metaDiaria} batida · ${texto}` : texto;
}

/** Por que o barrado não sai. */
export function textoDoBarrado(barrado: BarradoAgenda): string {
  return barrado.motivo === "marcador"
    ? `a mensagem sairia com ${barrado.marcador} sem resolver`
    : "a mensagem não tem telefone utilizável";
}

/** Quando a varredura apaga a demo, e quando ele sairia. */
export function textoDoVencido(vencido: VencidoAgenda, referenciaIso: string): string {
  const quando = (iso: string) => `${diaDoOperador(iso, referenciaIso)} ${horaDoOperador(iso)}`;
  return `demo apagada na varredura de ${quando(vencido.varreduraEm)} (venceu ${quando(vencido.venceEm)}) · sairia ${quando(vencido.sairiaEm)}`;
}

const NOME_DO_DIA = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];

/**
 * Até onde a agenda vai: "até o fim de amanhã", "até o fim de segunda" —
 * o dia operacional do horizonte (`horizonteDia`) contra o de quando a
 * agenda foi gerada (`diaOperacional`), os dois do servidor: com o dia
 * virando fora da meia-noite, o calendário diria "hoje" para um horizonte
 * que é amanhã. O teto é de sete dias contando hoje, então o nome do dia
 * nunca é o de hoje outra vez.
 */
export function textoDoHorizonte(agenda: Pick<AgendaFila, "horizonteDia" | "diaOperacional">): string {
  const hoje = Date.parse(`${agenda.diaOperacional}T00:00:00Z`);
  const dia = Date.parse(`${agenda.horizonteDia}T00:00:00Z`);
  const dias = Math.round((dia - hoje) / DIA_MS);
  if (dias <= 0) return "até o fim de hoje";
  if (dias === 1) return "até o fim de amanhã";
  return `até o fim de ${NOME_DO_DIA[new Date(dia).getUTCDay()]}`;
}

/** A linha do que sobrou — `undefined` quando não sobrou nada. */
export function textoDoFora(
  agenda: Pick<AgendaFila, "fora" | "parouPor" | "alvo" | "horizonteDia" | "diaOperacional">,
): string | undefined {
  if (agenda.fora === 0) return undefined;
  const elegiveis = `${agenda.fora} ${agenda.fora === 1 ? "elegível" : "elegíveis"}`;
  return agenda.parouPor === "alvo"
    ? `+ ${elegiveis} depois destes ${agenda.alvo}`
    : `${elegiveis} sem vez ${textoDoHorizonte(agenda)}`;
}
