/**
 * ESTADO DA GERAÇÃO DE CAPTURAS de um lead — o contrato entre as três
 * partes que nunca se falam diretamente:
 *
 *   1. a ROTA do Radar, que enfileira (`POST /api/leads/[id]/capturas`);
 *   2. o WORKFLOW no GitHub Actions, que roda o motor e escreve o
 *      resultado direto no Firestore (mesma credencial que usa pro
 *      Storage — nenhum endpoint público novo pra proteger);
 *   3. a FICHA, que mostra o andamento sem o operador recarregar nada.
 *
 * A execução leva minutos e acontece fora do processo do app, então o
 * estado é dado persistido no doc do lead, não memória de servidor: quem
 * abrir a ficha no meio do caminho (ou de outro aparelho) vê o mesmo.
 */

export const CAPTURA_ESTADOS = ["enfileirado", "rodando", "pronto", "falhou"] as const;
export type CapturaEstado = (typeof CAPTURA_ESTADOS)[number];

export const CAPTURA_TELAS = ["celular", "desktop"] as const;
export type CapturaTela = (typeof CAPTURA_TELAS)[number];

/** A versão COMPOSTA de uma captura — a mesma imagem dentro da moldura. */
export interface CapturaComposta {
  url: string;
  largura: number;
  altura: number;
}

/** Uma imagem pronta no Storage. */
export interface CapturaImagem {
  /** Id da seção-âncora que virou esta imagem (ver ./ancoras.ts). */
  ancora: string;
  tela: CapturaTela;
  /** Posição da âncora na marcação (1..3) — a ordem em que as capturas saem. */
  ordem: number;
  url: string;
  largura: number;
  altura: number;
  /**
   * A MESMA captura dentro da moldura desenhada — aparelho no celular,
   * janela de navegador no desktop (ver `capturas/moldura.mjs`). As duas
   * ficam guardadas porque servem a coisas diferentes: a composta é a que
   * se lê como "um site num aparelho" numa conversa, a crua é a que se
   * recorta, monta em carrossel e manda como detalhe.
   *
   * Ausente = a composição daquela imagem não saiu (ou a rodada é anterior
   * ao compositor). A galeria trata isso como vão explícito, nunca troca
   * calada pela crua: dizer "esta não tem moldura" é informação; entregar
   * a crua no lugar dela, sem avisar, é mentira pequena.
   */
  composta?: CapturaComposta;
}

/**
 * A IMAGEM DE PRÉVIA DO LINK — o cartão que aparece quando alguém cola o
 * endereço da demo numa conversa (o `og:image` de `/demo/{leadId}`).
 *
 * Uma por lead, não uma por âncora: é a prévia do SITE. Gerada junto com
 * as capturas e guardada no Storage porque o buscador de prévia do
 * WhatsApp não executa JavaScript e desiste depressa — a imagem tem que
 * existir pronta num endereço direto, sem o app renderizar nada na hora.
 */
export interface CapturaPrevia {
  url: string;
  largura: number;
  altura: number;
  /** O nome que a composição escreveu — o mesmo do lead, salvo pra conferir. */
  nome?: string;
}

/** `lead.capturas` — sempre a ÚLTIMA geração pedida, sobrescrita a cada refazer. */
export interface LeadCapturas {
  estado: CapturaEstado;
  /**
   * Id do pedido. O workflow carrega este id de volta e o Firestore só
   * aceita a escrita se ele ainda for o vigente — assim uma execução
   * antiga que termine DEPOIS de um "refazer" não sobrescreve o resultado
   * novo com o velho (ver `escritaAindaVale`).
   */
  execucaoId: string;
  /** Quando o operador pediu (o disparo). */
  pedidoEm: string;
  pedidoPor?: string;
  /** Quando o workflow começou de fato. */
  iniciadoEm?: string;
  /** HORÁRIO DE GERAÇÃO: quando as imagens ficaram prontas. */
  geradoEm?: string;
  /** Mensagem curta do que deu errado — só em `falhou`. */
  erro?: string;
  /** Link do run no GitHub, pra depurar uma falha sem adivinhação. */
  runUrl?: string;
  imagens?: CapturaImagem[];
  /**
   * Ausente = a rota pública serve o recurso de reserva no lugar (ver
   * `/demo/{leadId}/previa`). Nunca fica sem nada: um cartão de conversa
   * sem imagem é pior que um cartão simples.
   */
  previa?: CapturaPrevia;
}

/**
 * Quanto tempo um estado em andamento pode ficar sem notícia antes de ser
 * tratado como perdido.
 *
 * Existe porque o disparo é um `repository_dispatch`: o GitHub responde
 * 204 e pronto — se o workflow foi desabilitado, se o arquivo não está no
 * branch default ou se o runner nunca pegou a fila, NINGUÉM avisa. Sem
 * isto o lead ficaria "enfileirado" pra sempre, que é a mesma doença de
 * um botão que volta ao normal sem confirmação: um estado que mente.
 */
export const LIMITE_ENFILEIRADO_MS = 10 * 60 * 1000;
export const LIMITE_RODANDO_MS = 30 * 60 * 1000;

export function emAndamento(estado: CapturaEstado | undefined): boolean {
  return estado === "enfileirado" || estado === "rodando";
}

/**
 * A geração em andamento passou do tempo sem dar notícia? Pura, pra ser
 * a mesma regra na ficha, no lote e no teste.
 */
export function semNoticia(capturas: LeadCapturas | undefined, agoraMs: number): boolean {
  if (!capturas || !emAndamento(capturas.estado)) return false;
  const marco = capturas.estado === "rodando" ? capturas.iniciadoEm : capturas.pedidoEm;
  const desde = Date.parse(marco ?? capturas.pedidoEm);
  if (!Number.isFinite(desde)) return false;
  const limite = capturas.estado === "rodando" ? LIMITE_RODANDO_MS : LIMITE_ENFILEIRADO_MS;
  return agoraMs - desde > limite;
}

export interface EstadoVisivel {
  estado: CapturaEstado | "nunca";
  rotulo: string;
  /** Linha de apoio: horário de geração, motivo da falha, tempo decorrido. */
  detalhe?: string;
  /** A UI deve continuar perguntando? (só enquanto está de fato em andamento) */
  acompanhar: boolean;
}

/**
 * Estado como a UI deve mostrá-lo — inclusive a conversão de "em
 * andamento e sem notícia" em FALHA explícita. Nunca devolve um estado
 * que o operador não possa agir em cima.
 */
export function estadoVisivel(
  capturas: LeadCapturas | undefined,
  agoraMs: number,
): EstadoVisivel {
  if (!capturas) {
    return { estado: "nunca", rotulo: "Sem capturas", acompanhar: false };
  }
  if (semNoticia(capturas, agoraMs)) {
    return {
      estado: "falhou",
      rotulo: "Falhou",
      detalhe:
        capturas.estado === "enfileirado"
          ? "o workflow não respondeu ao disparo — confira se ele está habilitado no GitHub"
          : "a execução parou de dar notícia antes de terminar",
      acompanhar: false,
    };
  }
  switch (capturas.estado) {
    case "enfileirado":
      return { estado: "enfileirado", rotulo: "Enfileirado", detalhe: "aguardando o runner", acompanhar: true };
    case "rodando":
      return { estado: "rodando", rotulo: "Gerando…", detalhe: "leva alguns minutos", acompanhar: true };
    case "pronto":
      return {
        estado: "pronto",
        rotulo: `${capturas.imagens?.length ?? 0} captura${(capturas.imagens?.length ?? 0) === 1 ? "" : "s"}`,
        detalhe: capturas.geradoEm,
        acompanhar: false,
      };
    case "falhou":
      return { estado: "falhou", rotulo: "Falhou", detalhe: capturas.erro, acompanhar: false };
  }
}

/**
 * Uma escrita vinda do workflow ainda vale? Só se for da execução vigente.
 *
 * O caso que isto cobre: o operador manda gerar, acha demorado e clica em
 * "refazer". Passam a existir dois runs; o primeiro termina depois e, sem
 * esta guarda, enterraria o resultado do segundo — ou pior, marcaria
 * "falhou" por cima de um "pronto" legítimo.
 */
export function escritaAindaVale(
  atual: LeadCapturas | undefined,
  execucaoId: string,
): boolean {
  if (!atual) return false;
  return atual.execucaoId === execucaoId;
}

/** Agrupa as imagens por âncora, na ordem da marcação — como a ficha exibe. */
export function porAncora(
  imagens: CapturaImagem[],
): Array<{ ancora: string; ordem: number; telas: Partial<Record<CapturaTela, CapturaImagem>> }> {
  const mapa = new Map<string, { ancora: string; ordem: number; telas: Partial<Record<CapturaTela, CapturaImagem>> }>();
  for (const img of imagens) {
    const grupo = mapa.get(img.ancora) ?? { ancora: img.ancora, ordem: img.ordem, telas: {} };
    grupo.telas[img.tela] = img;
    grupo.ordem = Math.min(grupo.ordem, img.ordem);
    mapa.set(img.ancora, grupo);
  }
  return [...mapa.values()].sort((a, b) => a.ordem - b.ordem);
}

/**
 * Confirmação de um lote de disparos — o mesmo princípio da geração de
 * demos em lote: ao terminar, dizer o que aconteceu, nunca só voltar ao
 * normal. Aqui o "terminar" é o DISPARO (enfileirar), não a geração: a
 * geração em si é acompanhada por estado, lead a lead.
 */
export function mensagemDisparoLote(enfileirados: number, falhas: number, pulados: number): string {
  const partes = [`${enfileirados} lead${enfileirados === 1 ? "" : "s"} na fila`];
  if (pulados > 0) partes.push(`${pulados} pulado${pulados === 1 ? "" : "s"} (sem demo salva)`);
  if (falhas > 0) partes.push(falhas === 1 ? "1 falhou no disparo" : `${falhas} falharam no disparo`);
  return partes.join(" · ");
}
