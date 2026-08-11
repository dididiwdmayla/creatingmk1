import { horaDoMinuto } from "@/lib/leads/barraDoDia";
import { cidadeDoEndereco } from "@/lib/leads/cidade";
import { MIN_DIA, minutoDaSemanaLocal } from "@/lib/leads/horarios";
import {
  faixasDoDia,
  familiaDoLead,
  minutoDoDia,
  type FamiliaJanelaContato,
  type JanelasContatoConfig,
} from "@/lib/leads/janelaContato";
import { calculaScore } from "@/lib/leads/score";
import type { Lead } from "@/lib/leads/types";
import type { RegiaoIndice } from "@/lib/regioes";

import { normalizarPais, type PaisProspeccao } from "./paises";

/**
 * "ONDE NO MUNDO VALE PROSPECTAR AGORA" — a derivação por trás da tela
 * `/mundo`. Tudo aqui é função PURA (`now` sempre vem de fora) e tudo é
 * DERIVADO de coisa que o app já tem: os países de `/config`
 * (`./paises.ts`), as faixas por família de `janelaContato.ts` (as MESMAS
 * que pintam a barra do dia na ficha do lead), o índice de mercado já
 * cacheado em `/regioes` e os leads já salvos. Nenhuma chamada paga
 * participa de montar esta tela.
 *
 * A diferença para `barraDoDia.ts` é o que se sabe: lá existe UM lead, com
 * horário de funcionamento próprio, e a barra recorta as faixas por esse
 * expediente. Aqui existe um PAÍS — não há expediente a recortar, então
 * "faixa boa agora" é exatamente a faixa `bom` da família na hora local
 * daquele país. País que não está numa faixa `bom` neste minuto não entra
 * na tela: o minuto neutro (`razoavel`) não é motivo pra acordar ninguém.
 */

/** Ordem dos idiomas na tela: português, inglês, espanhol, depois o resto. */
export const ORDEM_IDIOMAS = ["pt", "en", "es"] as const;

const NOME_DIA = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"] as const;

export interface FaixaBoa {
  /** Minuto do dia (hora local do país) em que a faixa boa começa/termina. */
  inicioMin: number;
  fimMin: number;
}

export interface ProximaFaixaBoa extends FaixaBoa {
  /** 0 = hoje, 1 = amanhã… na hora local do país. */
  offsetDias: number;
  /** "hoje" | "amanhã" | "quarta" */
  rotuloDia: string;
}

export type FonteIndice = "regioes" | "config";

export interface IndicePais {
  indice: number;
  /**
   * `regioes` = média das cidades daquele país já cacheadas em `/regioes`
   * (o índice REAL, gerado por IA na primeira vez que a cidade foi
   * buscada); `config` = o número base da lista de países, que é só um
   * ponto de partida editável.
   */
  fonte: FonteIndice;
  /** Quantas cidades entraram na média (0 quando a fonte é a config). */
  cidades: number;
}

export interface PaisAgora {
  pais: PaisProspeccao;
  /** 0=domingo…6=sábado, hora local do país. */
  diaSemana: number;
  /** Minuto do dia AGORA, hora local do país. */
  minutoLocal: number;
  /** "8h30" — hora local do país, pronta pra tela. */
  horaLocal: string;
  /** A faixa boa que cobre este minuto. */
  faixa: FaixaBoa;
  indice: IndicePais;
  /**
   * Leads deste país e desta família que ainda não foram contatados,
   * melhores primeiro. Vazio = a tela manda pra busca em vez de listar.
   */
  leads: Lead[];
}

/** País que NÃO está em faixa boa agora — só para o estado vazio da tela. */
export interface PaisEmBreve {
  pais: PaisProspeccao;
  proxima: ProximaFaixaBoa;
  /** Minutos daqui até o começo da próxima faixa boa (é por ele que se ordena). */
  emMinutos: number;
}

export interface Mundo {
  /** Países em faixa boa AGORA, na ordem final da tela. */
  paises: PaisAgora[];
  /**
   * Só quando `paises` está vazio: o país que entra em faixa boa primeiro.
   * Existe para a tela às 3h da manhã não ser uma folha em branco — a
   * pergunta "e quando, então?" é a mesma pergunta.
   */
  emBreve?: PaisEmBreve;
}

/** Posição do país na ordem de idiomas (o melhor idioma dele manda). */
export function rankIdioma(idiomas: string[]): number {
  const ranks = idiomas.map((idioma) => {
    const raiz = idioma.split("-")[0].toLowerCase();
    const i = ORDEM_IDIOMAS.indexOf(raiz as (typeof ORDEM_IDIOMAS)[number]);
    return i === -1 ? ORDEM_IDIOMAS.length : i;
  });
  return ranks.length > 0 ? Math.min(...ranks) : ORDEM_IDIOMAS.length;
}

/**
 * A faixa `bom` da família que cobre ESTE minuto na hora local do país, se
 * houver. Sem faixa cobrindo (inclusive o neutro `razoavel`, que é o
 * default de minuto não marcado) → `undefined`, e o país não aparece.
 */
export function faixaBoaAgora(
  familia: FamiliaJanelaContato,
  utcOffsetMinutos: number,
  now: Date,
): { diaSemana: number; minutoLocal: number; faixa?: FaixaBoa } {
  const nowMin = minutoDaSemanaLocal(utcOffsetMinutos, now);
  const diaSemana = Math.floor(nowMin / MIN_DIA);
  const minutoLocal = nowMin - diaSemana * MIN_DIA;
  const cobrindo = faixasDoDia(familia, diaSemana).find(
    (f) =>
      f.nivel === "bom" && minutoLocal >= minutoDoDia(f.inicio) && minutoLocal < minutoDoDia(f.fim),
  );
  return {
    diaSemana,
    minutoLocal,
    ...(cobrindo && {
      faixa: { inicioMin: minutoDoDia(cobrindo.inicio), fimMin: minutoDoDia(cobrindo.fim) },
    }),
  };
}

/**
 * Próxima faixa boa daquele país a partir de agora, varrendo até 7 dias à
 * frente — mesmo varrimento de `acharProximoBom` (barra do dia), sem o
 * recorte por horário de funcionamento (aqui não há lead, só país).
 */
export function proximaFaixaBoa(
  familia: FamiliaJanelaContato,
  utcOffsetMinutos: number,
  now: Date,
): ProximaFaixaBoa | undefined {
  const nowMin = minutoDaSemanaLocal(utcOffsetMinutos, now);
  const diaHoje = Math.floor(nowMin / MIN_DIA);
  const minutoAgora = nowMin - diaHoje * MIN_DIA;

  for (let offsetDias = 0; offsetDias <= 7; offsetDias++) {
    const dia = (diaHoje + offsetDias) % 7;
    const limite = offsetDias === 0 ? minutoAgora : -1;
    const proxima = faixasDoDia(familia, dia)
      .filter((f) => f.nivel === "bom" && minutoDoDia(f.fim) > limite)
      .map((f) => ({ inicioMin: minutoDoDia(f.inicio), fimMin: minutoDoDia(f.fim) }))
      .sort((a, b) => a.inicioMin - b.inicioMin)[0];
    if (proxima) {
      return {
        offsetDias,
        rotuloDia: offsetDias === 0 ? "hoje" : offsetDias === 1 ? "amanhã" : NOME_DIA[dia],
        inicioMin: Math.max(proxima.inicioMin, limite),
        fimMin: proxima.fimMin,
      };
    }
  }
  return undefined;
}

/**
 * Índice de mercado do país: a média das cidades DAQUELE país já cacheadas
 * em `/regioes` vence o número base da config — o índice do cache foi
 * gerado para a cidade específica e já pode ter sido ajustado à mão pelo
 * admin (`indiceAjustado` vence `indice`, a mesma precedência de
 * `calcularIndiceEfetivo`). Sem nenhuma cidade cacheada, vale a config.
 * Nada aqui gera índice novo: gerar é chamada paga, e esta tela não faz
 * nenhuma.
 */
export function indiceDoPais(pais: PaisProspeccao, regioes: RegiaoIndice[]): IndicePais {
  const chave = normalizarPais(pais.nome);
  const valores = regioes
    .filter((regiao) => normalizarPais(regiao.pais ?? "") === chave)
    .map((regiao) => regiao.indiceAjustado ?? regiao.indice)
    .filter((valor): valor is number => typeof valor === "number" && Number.isFinite(valor));
  if (valores.length === 0) return { indice: pais.indice, fonte: "config", cidades: 0 };
  const media = valores.reduce((soma, valor) => soma + valor, 0) / valores.length;
  return { indice: media, fonte: "regioes", cidades: valores.length };
}

/**
 * "Ainda não contatado": status `novo`, sem o selo de contato (o carimbo
 * do clique no WhatsApp, que existe independente do fluxo de status) e não
 * descartado. Os três juntos, porque cada um sozinho deixa passar um lead
 * que já foi trabalhado.
 */
export function naoContatado(lead: Lead): boolean {
  return lead.status === "novo" && lead.seloContato === undefined && lead.descartado !== true;
}

/**
 * Leads não contatados de um país e de uma família, melhores primeiro. O
 * país sai do ENDEREÇO do lead (`cidadeDoEndereco`, o mesmo caminho que a
 * barra do dia usa pra derivar fuso) e a família, do nicho da busca que o
 * trouxe (`familiaDoLead`) — as duas derivações que já existem, nenhum
 * campo novo no doc do lead.
 */
export function leadsDoPais(leads: Lead[], nomePais: string, familia: string): Lead[] {
  const chave = normalizarPais(nomePais);
  return leads
    .filter(
      (lead) =>
        naoContatado(lead) &&
        familiaDoLead(lead) === familia &&
        lead.endereco !== undefined &&
        normalizarPais(cidadeDoEndereco(lead.endereco).pais ?? "") === chave,
    )
    .sort((a, b) => calculaScore(b) - calculaScore(a) || b.criadoEm.localeCompare(a.criadoEm));
}

/**
 * A ordem da tela: **idioma primeiro** (português, inglês, espanhol,
 * depois os demais) e, dentro do mesmo idioma, **índice de preço
 * decrescente** — falar a língua sem esforço vale mais que preço, e
 * empatados no idioma ganha quem paga melhor. Empate nos dois: nome, só
 * pra ordem ser estável.
 */
export function ordenarPaises(paises: PaisAgora[]): PaisAgora[] {
  return [...paises].sort(
    (a, b) =>
      rankIdioma(a.pais.idiomas) - rankIdioma(b.pais.idiomas) ||
      b.indice.indice - a.indice.indice ||
      a.pais.nome.localeCompare(b.pais.nome),
  );
}

/**
 * O MESMO formatador da barra do dia (reexportado, não recriado): as duas
 * telas dizem hora do mesmo jeito, e "9h30" nunca vira "09:30" numa delas.
 */
export { horaDoMinuto };

/**
 * A tela inteira, derivada. `familia` é uma chave de `janelasContato` (as
 * famílias da barra do dia); família desconhecida devolve tela vazia em vez
 * de inventar faixa.
 */
export function montarMundo(opts: {
  paises: PaisProspeccao[];
  janelas: JanelasContatoConfig;
  familia: string;
  leads: Lead[];
  regioes: RegiaoIndice[];
  now: Date;
}): Mundo {
  const familia = opts.janelas[opts.familia];
  if (!familia) return { paises: [] };

  const emFaixa: PaisAgora[] = [];
  const fora: PaisEmBreve[] = [];

  for (const pais of opts.paises) {
    const { diaSemana, minutoLocal, faixa } = faixaBoaAgora(familia, pais.utcOffsetMinutos, opts.now);
    if (!faixa) {
      const proxima = proximaFaixaBoa(familia, pais.utcOffsetMinutos, opts.now);
      if (proxima) {
        fora.push({
          pais,
          proxima,
          emMinutos: proxima.offsetDias * MIN_DIA + proxima.inicioMin - minutoLocal,
        });
      }
      continue;
    }
    emFaixa.push({
      pais,
      diaSemana,
      minutoLocal,
      horaLocal: horaDoMinuto(minutoLocal),
      faixa,
      indice: indiceDoPais(pais, opts.regioes),
      leads: leadsDoPais(opts.leads, pais.nome, opts.familia),
    });
  }

  const paises = ordenarPaises(emFaixa);
  if (paises.length > 0) return { paises };
  const emBreve = [...fora].sort((a, b) => a.emMinutos - b.emMinutos)[0];
  return { paises, ...(emBreve && { emBreve }) };
}
