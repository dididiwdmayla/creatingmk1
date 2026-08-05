import type { DemoDataPatch, ImagensModo, TemaPatch } from "./types";

/**
 * Geração de demos em lote a partir de um grupo de busca (`/leads?buscaId=`
 * → diálogo "Gerar demos em lote"). Skin/preset de tema/efeito/modo de
 * imagem são escolhidos UMA vez no diálogo e valem para todo o lote — cada
 * lead recebe o mesmo patch de criação, só o `skinId`/`themeId` do PUT
 * muda por lead (o conteúdo em si continua vindo de `montarDemoData`,
 * camada exemplo ← lead, como qualquer demo nova).
 *
 * Criar demo é só `PUT /api/leads/[id]/demo` (Firestore, sem request pago)
 * — por isso o lote inteiro roda sem tocar cota nenhuma.
 */

export interface ConfigCriacaoLote {
  skinId: string;
  themeId: string;
  /** Id de um efeito do registro (ver `efeitos/registry.ts`), ou "nenhum"/ausente = sem efeito. */
  efeitoId?: string;
  imagensModo: ImagensModo;
}

/**
 * Monta o `{dados, tema}` do PUT de criação a partir da configuração do
 * diálogo. Só entra no patch o que difere do default (efeito "nenhum"/
 * ausente não escreve `tema`; modo "foto" — o default — não escreve
 * `imagensModo`), mesmo princípio de `montarPatch`.
 */
export function patchCriacaoLote(config: ConfigCriacaoLote): {
  dados: DemoDataPatch;
  tema?: TemaPatch;
} {
  const dados: DemoDataPatch = {};
  if (config.imagensModo !== "foto") {
    dados.imagensModo = config.imagensModo;
  }

  const tema: TemaPatch = {};
  if (config.efeitoId && config.efeitoId !== "nenhum") {
    tema.fundoEfeito = config.efeitoId;
  }

  return Object.keys(tema).length > 0 ? { dados, tema } : { dados };
}

/** Resultado de UM lead processado num lote (criação ou geração de texto). */
export interface ResultadoLote {
  placeId: string;
  nome: string;
  ok: boolean;
  /** Mensagem curta do erro — só presente quando `ok` é `false`. */
  erro?: string;
}

/** Resumo do lote inteiro — o relatório final (item "processamento resiliente"). */
export interface RelatorioLote {
  sucessos: ResultadoLote[];
  falhas: ResultadoLote[];
  /** Lote interrompido pelo usuário antes de processar todos os leads selecionados. */
  cancelado: boolean;
}

export function relatorioVazio(): RelatorioLote {
  return { sucessos: [], falhas: [], cancelado: false };
}

/**
 * Mensagem de confirmação clara ao fim de um lote (item "processamento
 * resiliente" — nunca só "voltou ao normal" sem dizer o que aconteceu):
 * quantas demos foram criadas, quantas foram PULADAS (leads do grupo que
 * nunca chegaram a ser tentados — já tinham demo, ficaram desmarcados, ou
 * o lote foi cancelado antes de alcançá-los) e quantas falharam.
 * `totalGrupo` é o tamanho do grupo inteiro (não só os selecionados), pra
 * "pulada" cobrir os dois motivos de exclusão sem precisar distingui-los.
 */
export function mensagemResultadoLote(relatorio: RelatorioLote, totalGrupo: number): string {
  const criadas = relatorio.sucessos.length;
  const falhas = relatorio.falhas.length;
  const puladas = Math.max(0, totalGrupo - criadas - falhas);

  const partes = [
    `${criadas} demo${criadas === 1 ? "" : "s"} criada${criadas === 1 ? "" : "s"}`,
    `${puladas} pulada${puladas === 1 ? "" : "s"}`,
  ];
  if (falhas > 0) {
    partes.push(falhas === 1 ? "1 falhou" : `${falhas} falharam`);
  }
  if (relatorio.cancelado) {
    partes.push("cancelado antes do fim");
  }
  return partes.join(" · ");
}

/**
 * Projeção de chamadas à IA do lote de geração de texto: 1 chamada por
 * lead no caso normal, até 2 quando a resposta do Gemini sai fora do
 * schema e a rota tenta de novo (ver `gerarSugestaoDemo`, retry único).
 * Não dá pra saber ANTES quantos leads vão precisar do retry — por isso a
 * confirmação mostra a faixa inteira, nunca um número só que possa mentir
 * pra baixo.
 */
export function projecaoChamadasIA(quantidadeLeads: number): { minimo: number; maximo: number } {
  return { minimo: quantidadeLeads, maximo: quantidadeLeads * 2 };
}

/** Estado da cota de IA do usuário antes/depois do lote (pior caso), pra confirmação. */
export interface ProjecaoCotaIA {
  usado: number;
  teto: number;
  restanteAntes: number;
  /** Restante depois do lote no MELHOR caso (1 chamada por lead). */
  restanteDepoisMin: number;
  /** Restante depois do lote no PIOR caso (2 chamadas por lead, todo mundo com retry). */
  restanteDepoisMax: number;
  /** O pior caso sozinho já estoura o teto restante? Aviso, não bloqueio — o servidor que barra de verdade. */
  podeEstourar: boolean;
}

export function projecaoCotaIA(
  usado: number,
  teto: number,
  quantidadeLeads: number,
): ProjecaoCotaIA {
  const { minimo, maximo } = projecaoChamadasIA(quantidadeLeads);
  const restanteAntes = Math.max(0, teto - usado);
  return {
    usado,
    teto,
    restanteAntes,
    restanteDepoisMin: Math.max(0, teto - (usado + minimo)),
    restanteDepoisMax: Math.max(0, teto - (usado + maximo)),
    podeEstourar: usado + maximo > teto,
  };
}
