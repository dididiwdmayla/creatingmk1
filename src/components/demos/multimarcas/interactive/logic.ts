/**
 * Funções puras compartilhadas pelos widgets interativos da skin
 * "Multimarcas Vórtice" — sem DOM, sem React, testáveis isoladamente.
 */

/** Link wa.me a partir de `data.whatsapp` (dígitos livres) — fiel ao `getter wa` do material bruto. */
export function waHref(whatsapp: string | undefined, mensagem: string): string | undefined {
  const digitos = (whatsapp ?? "").replace(/\D/g, "");
  // Sem número não há link: `wa.me/` sem destino abre o WhatsApp em
  // branco, e um CTA que não leva a lugar nenhum é pior que CTA nenhum.
  // Quem chama esconde o botão (mesmo princípio de `orderWaHref` da
  // lancheria). Vale sempre que `whatsapp` está vazio — o caso comum
  // numa demo AVULSA sem WhatsApp digitado, e também num lead cujo
  // telefone o Google não devolveu.
  if (!digitos) return undefined;
  return `https://wa.me/${digitos}?text=${encodeURIComponent(mensagem)}`;
}

export interface NumeroFormatado {
  /** Texto antes do número (ex.: "+", "R$ "). */
  prefixo: string;
  /** Texto depois do número (ex.: "★", " anos"). */
  sufixo: string;
  /** Valor alvo da contagem. */
  alvo: number;
  /** Casas decimais a preservar na formatação (0 = inteiro). */
  casas: number;
}

/**
 * Extrai {prefixo, alvo, casas, sufixo} de um texto formatado no padrão
 * pt-BR (ponto = milhar, vírgula = decimal) — usado tanto pelos contadores
 * da seção "Números" ("+1.200", "4,9★", "15 anos") quanto pelo preço dos
 * veículos ("R$ 89.900"), pra animar a contagem no scroll (StatCounter/
 * CarCard) sem exigir um campo numérico extra no contrato: o texto exibido
 * JÁ carrega tudo que a animação precisa.
 */
export function parseNumeroFormatado(texto: string): NumeroFormatado | null {
  const m = /^([^\d]*)([\d.,]+)(.*)$/.exec(texto.trim());
  if (!m) return null;
  const [, prefixo, numero, sufixo] = m;
  const casas = numero.includes(",") ? numero.split(",")[1]?.length ?? 0 : 0;
  const normalizado = numero.replace(/\./g, "").replace(",", ".");
  const alvo = Number.parseFloat(normalizado);
  if (!Number.isFinite(alvo)) return null;
  return { prefixo, sufixo, alvo, casas };
}

/** Formata um valor intermediário da animação de contagem no padrão pt-BR. */
export function formatarNumeroBR(valor: number, casas: number): string {
  return valor.toLocaleString("pt-BR", {
    minimumFractionDigits: casas,
    maximumFractionDigits: casas,
  });
}

/**
 * Sentinela interna do filtro "sem categoria selecionada" — nunca exibida
 * como está: o rótulo visível vem de `microcopiaDemo(idioma).todos`
 * (CarFilterGrid.tsx), traduzido por idioma da demo.
 */
export const TODAS_CATEGORIAS = "__todas__";

/** Categorias distintas dos veículos, na ordem de primeira aparição, com a sentinela "todas" à frente. */
export function categoriasDoEstoque(
  servicos: readonly { categoria?: string }[],
): string[] {
  const vistas = new Set<string>();
  for (const s of servicos) {
    if (s.categoria) vistas.add(s.categoria);
  }
  return [TODAS_CATEGORIAS, ...vistas];
}

/** Colapsa espaços e quebras de linha — `quebrarTitulo` põe `\n` no nome. */
function semEspacosExtras(texto: string): string {
  return texto.replace(/\s+/g, " ").trim();
}

/**
 * A LINHA DE APOIO da abertura (docs/plano-multimarcas.md §6.1): o `<h1>`
 * é sempre o nome do negócio, e `secoes.hero.titulo` — o mesmo slot de
 * sempre, sem migração — vira a linha logo abaixo dele. Devolve o texto a
 * desenhar, ou `undefined` quando a linha não existe:
 *
 * - vazio ou só espaço: não existe (o `??` antigo desenhava `<h1>` vazio);
 * - igual ao nome, sem caixa e sem espaços/quebras nas pontas ou no meio:
 *   não existe — é o caso normal de todo lead, porque `dadosDoLead` e a
 *   avulsa gravam `quebrarTitulo(nome)` no título, e o nome não aparece
 *   duas vezes.
 */
export function linhaDeApoio(titulo: string | undefined, nome: string): string | undefined {
  const limpo = semEspacosExtras(titulo ?? "");
  if (!limpo) return undefined;
  if (limpo.toLocaleLowerCase() === semEspacosExtras(nome).toLocaleLowerCase()) return undefined;
  return limpo;
}

/** O nome em duas linhas de palavras (a segunda no acento), metade a metade. */
export function linhasDoNome(nome: string): [string[], string[]] {
  const palavras = semEspacosExtras(nome).split(" ").filter(Boolean);
  const meio = Math.ceil(palavras.length / 2);
  return [palavras.slice(0, meio), palavras.slice(meio)];
}
