import type { CapturaEstado } from "@/lib/demos/capturas/estado";
import type { AprovacaoDemo } from "@/lib/demos/types";

import type { Estoque } from "./balde";
import type { AutomacaoConfig } from "./config";
import type { ExecucaoAtiva } from "./disparo";
import type { EstadoExecucao, EstadoUnidade } from "./execucao";

/**
 * O que o painel "Automação" da /config recebe — tipos e as poucas funções
 * PURAS que a tela usa. Sem nada de servidor: é importado pelo componente
 * (`components/config/paineis/Automacao.tsx`). Quem monta é
 * `lib/automacao/painel.ts`.
 */

/**
 * A execução apontada por `/automacao/ultima`, RESUMIDA — o doc inteiro tem
 * o plano com todas as unidades, e a tela só precisa do que dizer: quando,
 * como terminou, o que fez e por que parou.
 */
export interface ResumoExecucao {
  id: string;
  estado: EstadoExecucao;
  disparo: string;
  runUrl?: string;
  iniciadaEm: string;
  finalizadaEm?: string;
  alvo: number;
  falta: number;
  estoqueAntes?: Estoque;
  estoqueDepois?: Estoque;
  demosCriadas: number;
  buscas: number;
  leadsNovos: number;
  requisicoesBusca: number;
  chamadasIA: number;
  falhas: number;
  /** O motivo da primeira falha de unidade — o que abrir primeiro. */
  primeiraFalha?: string;
  unidades: Partial<Record<EstadoUnidade, number>>;
  motivo?: string;
  erro?: string;
}

/** Uma demo automática esperando o operador. */
export interface ItemAprovacao {
  leadId: string;
  nome: string;
  nicho: string;
  cidade: string;
  skinId: string;
  skinNome: string;
  themeId: string;
  presetNome: string;
  demoCriadaEm: string;
  captura: {
    estado: CapturaEstado | "nunca";
    rotulo: string;
    detalhe?: string;
    /** Print do hero (celular, cru) — só com a captura pronta. */
    heroUrl?: string;
  };
}

export interface PainelAutomacao {
  config: AutomacaoConfig;
  /** Retrato da última varredura do pool; `null` = nunca houve varredura. */
  estoque: (Estoque & { geradoEm: string }) | null;
  ultima: ResumoExecucao | null;
  ativa: ExecucaoAtiva | null;
  aprovacao: { itens: ItemAprovacao[]; total: number };
  /** O "rodar agora" está configurado (token do GitHub na Vercel)? */
  disparoDisponivel: boolean;
}

/**
 * Prazo PADRÃO da expiração da demo automática não enviada, em horas a
 * partir de `demo.criadoEm` (ver `lib/automacao/expiracao.ts`). Mora aqui,
 * no módulo client-safe, porque a config valida e a tela mostra.
 */
export const EXPIRACAO_PADRAO_HORAS = 72;

/**
 * Prazo MÍNIMO aceito. Um "7" digitado no lugar de "72" apagaria a noite
 * anterior inteira antes de o operador aprovar qualquer coisa.
 */
export const EXPIRACAO_MIN_HORAS = 24;

/** Teto por chamada da aprovação em lote — cada lead é uma leitura e uma escrita. */
export const APROVACAO_LOTE_MAX = 50;

export type DecisaoLote = Extract<AprovacaoDemo, "aprovada" | "reprovada">;

export interface ResultadoAprovacaoLote {
  leadId: string;
  ok: boolean;
  erro?: string;
}

/** Nicho de busca sem skin nenhuma (ver `lib/demos/nichosSemSkin.ts`). */
export interface NichoSemSkinPainel {
  nicho: string;
  buscas: number;
  leads: number;
}

export interface ParSaturadoPainel {
  chave: string;
  nicho: string;
  regiao: string;
  /** Leads novos das últimas execuções da automação, mais recente primeiro. */
  novos: number[];
  ultimaEm: string;
}

export interface OperadorAutomacao {
  nichosSemSkin: NichoSemSkinPainel[];
  paresSaturados: ParSaturadoPainel[];
  /** A régua da saturação em vigor, para a tela dizer o critério. */
  saturacao: { execucoes: number; minNovos: number };
}

/**
 * A execução "rodando" cuja trava já venceu morreu sem finalizar (o
 * `finalizar` com `if: always()` também não chegou). Para a tela, isso é
 * FALHA — dizer "em andamento" seria mentir.
 */
export function execucaoMorta(ultima: ResumoExecucao | null, ativa: ExecucaoAtiva | null): boolean {
  return ultima?.estado === "rodando" && !(ativa?.tipo === "execucao" && ativa.execucaoId === ultima.id);
}

export function falhou(ultima: ResumoExecucao | null, ativa: ExecucaoAtiva | null): boolean {
  return ultima?.estado === "falhou" || execucaoMorta(ultima, ativa);
}

/**
 * A linha do cabeçalho FECHADO: "ligada · estoque 12/15 · 3 aguardando
 * aprovação". Sai inteira da resposta que o corpo já usa.
 *
 * `curto` é a forma do CELULAR ("ligada · 12/15 · 3 a aprovar"): na largura
 * de 390px a forma longa não cabe ao lado do título e seria truncada — e um
 * resumo truncado não diz o estado (medido pelo `--so=automacao`). Na forma
 * curta, com espaço para um aviso só, a falha (ou a execução rodando) vem
 * antes da contagem de pendentes: é o que pede ação primeiro.
 */
export function resumoCabecalho(painel: PainelAutomacao | null, curto = false): string {
  if (!painel) return "carregando…";
  const partes = [painel.config.ativo ? "ligada" : "desligada"];
  if (painel.estoque) {
    const conta = `${painel.estoque.total}/${painel.config.alvoEstoque}`;
    partes.push(curto ? conta : `estoque ${conta}`);
  }
  const pendentes = painel.aprovacao.total;
  const aviso = painel.ativa ? "rodando" : falhou(painel.ultima, painel.ativa) ? "última falhou" : undefined;
  if (curto) {
    if (aviso) partes.push(aviso);
    else if (pendentes > 0) partes.push(`${pendentes} a aprovar`);
    return partes.join(" · ");
  }
  if (pendentes > 0) partes.push(`${pendentes} aguardando aprovação`);
  if (aviso) partes.push(aviso);
  return partes.join(" · ");
}
