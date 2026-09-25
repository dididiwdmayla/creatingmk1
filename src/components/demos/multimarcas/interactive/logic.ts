import { IDIOMA_PADRAO } from "@/lib/idioma";
import type { DemoMicrocopia } from "@/lib/demos/microcopy";
import { contrasteWcag, HEX_RE, inkPara } from "@/lib/demos/contraste";
import type { ThemePaleta } from "@/lib/demos/types";
import { MOEDA_PADRAO } from "@/lib/moeda";

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

/** Separadores de milhar e decimal do locale ("." e "," em pt-BR, "’" e "." em de-CH). */
function separadores(idioma: string | undefined): { milhar: string; decimal: string } {
  const partes = new Intl.NumberFormat(idioma ?? IDIOMA_PADRAO).formatToParts(12345.6);
  return {
    milhar: partes.find((p) => p.type === "group")?.value ?? ".",
    decimal: partes.find((p) => p.type === "decimal")?.value ?? ",",
  };
}

const escapar = (t: string) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Extrai {prefixo, alvo, casas, sufixo} de um texto formatado no padrão do
 * LOCALE da demo — pt-BR por default (ponto = milhar, vírgula = decimal),
 * mas "+1,200" em en-US e "1’200" em de-CH também são 1200: o contador da
 * seção "Números" é conteúdo, e a IA o escreve no idioma do lead. Usado
 * pelos contadores ("+1.200", "15 anos") e pelo preço dos veículos, pra
 * animar a contagem sem exigir um campo numérico extra no contrato: o
 * texto exibido JÁ carrega tudo que a animação precisa.
 */
export function parseNumeroFormatado(texto: string, idioma?: string): NumeroFormatado | null {
  const { milhar, decimal } = separadores(idioma);
  // Milhar que é espaço (fr, de-CH antigo…) aceita qualquer espaço: quem
  // digita não escolhe entre U+0020, U+00A0 e U+202F.
  // Apóstrofo idem (de-CH sai com ' ou ’ conforme a versão do ICU).
  const grupo = /\s/.test(milhar)
    ? "\\s\u00a0\u202f"
    : /['’]/.test(milhar)
      ? "'’"
      : escapar(milhar);
  // O separador de milhar só conta ENTRE dígitos: "15 anos" não come o
  // espaço antes de "anos" num locale cujo milhar é espaço.
  const re = new RegExp(`^(\\D*?)(\\d(?:[${grupo}]?\\d)*(?:${escapar(decimal)}\\d+)?)(.*)$`, "u");
  const m = re.exec(texto.trim());
  if (!m) return null;
  const [, prefixo, numero, sufixo] = m;
  const [inteiro, fracao = ""] = numero.split(decimal);
  const alvo = Number.parseFloat(`${inteiro.replace(/\D/g, "")}${fracao ? `.${fracao}` : ""}`);
  if (!Number.isFinite(alvo)) return null;
  return { prefixo, sufixo, alvo, casas: fracao.length };
}

/** Formata um valor (intermediário da contagem ou final) pelo locale da demo. */
export function formatarNumero(valor: number, casas: number, idioma?: string): string {
  return valor.toLocaleString(idioma ?? IDIOMA_PADRAO, {
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
 * A LINHA DE APOIO da abertura (§6.1) — promovida para `lib/demos/montar.ts`
 * na migração da tatuagem-pigmento-vivo (docs/plano-tatuagem-pigmento-vivo.md
 * §7/§17 D3): outra skin com o mesmo eixo de variantes precisava da mesma
 * regra, e a função não tinha nada de específico da multimarcas. Reexportada
 * aqui para `Hero.tsx` (e qualquer outro import existente) continuarem
 * funcionando sem mudar de caminho.
 */
export { linhaDeApoio } from "@/lib/demos/montar";

/** O nome em duas linhas de palavras (a segunda no acento), metade a metade. */
export function linhasDoNome(nome: string): [string[], string[]] {
  const palavras = semEspacosExtras(nome).split(" ").filter(Boolean);
  const meio = Math.ceil(palavras.length / 2);
  return [palavras.slice(0, meio), palavras.slice(meio)];
}

/**
 * Uma FAIXA DE PREÇO do estoque (busca por faixa — docs/plano-multimarcas.md
 * §5). `min` inclusivo, `max` exclusivo; ausente = aberta naquela ponta.
 * `id` é também a ÂNCORA (`#faixa-N`): sem JavaScript, o link de uma faixa
 * leva ao estoque inteiro; com, o filtro lê o hash e recorta.
 */
export interface FaixaDePreco {
  id: string;
  min?: number;
  max?: number;
}

/**
 * Arredonda um corte para um número "de vitrine", a dois algarismos
 * significativos: 59.900 → 60.000, 61.900 → 62.000, 449.900 → 450.000.
 * (Meio algarismo — passo de 5.000 num estoque de 40 a 70 mil — juntava
 * dois cortes no mesmo valor e deixava as faixas do Pátio tortas.)
 */
function arredondarCorte(valor: number): number {
  const passo = Math.max(1, Math.pow(10, Math.floor(Math.log10(valor)) - 1));
  return Math.max(passo, Math.round(valor / passo) * passo);
}

/**
 * As 3–4 faixas derivadas do `precoValor` do estoque — nunca uma tabela
 * fixa: o estoque de um pátio de populares e o de uma boutique de
 * esportivos não cabem nas mesmas faixas. Cortes nos quantis do estoque
 * (quatro faixas a partir de oito carros, três abaixo disso), arredondados
 * para valor de vitrine; faixa que ficaria vazia sai. Menos de três preços
 * distintos, ou menos de duas faixas no fim: não há busca (lista vazia).
 */
export function faixasDePreco(servicos: readonly { precoValor?: number }[]): FaixaDePreco[] {
  const valores = servicos
    .map((s) => s.precoValor)
    .filter((v): v is number => v !== undefined && Number.isFinite(v) && v > 0)
    .sort((a, b) => a - b);
  if (new Set(valores).size < 3) return [];

  const partes = valores.length >= 8 ? 4 : 3;
  const cortes: number[] = [];
  for (let k = 1; k < partes; k++) {
    const corte = arredondarCorte(valores[Math.floor((k * valores.length) / partes)]);
    if (corte > valores[0] && corte <= valores[valores.length - 1] && !cortes.includes(corte)) {
      cortes.push(corte);
    }
  }
  const limites = [undefined, ...cortes, undefined];
  const faixas: Omit<FaixaDePreco, "id">[] = [];
  for (let i = 0; i < limites.length - 1; i++) {
    const faixa = { min: limites[i], max: limites[i + 1] };
    if (valores.some((v) => valorNaFaixa(v, faixa))) faixas.push(faixa);
  }
  if (faixas.length < 2) return [];
  return faixas.map((f, i) => ({
    id: `faixa-${i + 1}`,
    ...(f.min !== undefined && { min: f.min }),
    ...(f.max !== undefined && { max: f.max }),
  }));
}

/** O carro de valor `valor` cai na faixa? (`min` inclusivo, `max` exclusivo.) */
export function valorNaFaixa(valor: number | undefined, faixa: Pick<FaixaDePreco, "min" | "max">): boolean {
  if (valor === undefined) return false;
  return (faixa.min === undefined || valor >= faixa.min) && (faixa.max === undefined || valor < faixa.max);
}

/** Valor de moeda sem centavos, pelo locale/moeda da demo ("R$ 60.000", "CHF 60’000"). */
export function valorCurto(valor: number, idioma: string | undefined, moeda: string | undefined): string {
  return new Intl.NumberFormat(idioma ?? IDIOMA_PADRAO, {
    style: "currency",
    currency: moeda ?? MOEDA_PADRAO,
    maximumFractionDigits: 0,
  }).format(valor);
}

/** O id da faixa pedida pelo hash da URL (`#faixa-2`), se existir no estoque. */
export function faixaDoHash(hash: string, faixas: readonly FaixaDePreco[]): string | undefined {
  const id = hash.replace(/^#/, "");
  return faixas.some((f) => f.id === id) ? id : undefined;
}

/** Rótulo de uma faixa no locale/moeda da demo ("Até R$ 60.000", "R$ 60.000 a R$ 90.000"). */
export function rotuloFaixa(
  faixa: Pick<FaixaDePreco, "min" | "max">,
  m: Pick<DemoMicrocopia, "faixaAte" | "faixaEntre" | "faixaAcima">,
  idioma: string | undefined,
  moeda: string | undefined,
): string {
  const v = (n: number) => valorCurto(n, idioma, moeda);
  if (faixa.min === undefined && faixa.max !== undefined) return m.faixaAte(v(faixa.max));
  if (faixa.max === undefined && faixa.min !== undefined) return m.faixaAcima(v(faixa.min));
  return m.faixaEntre(v(faixa.min ?? 0), v(faixa.max ?? 0));
}

/** Faixa, passo e ponto de partida do slider de valor do simulador. */
export interface FaixaSimulador {
  min: number;
  max: number;
  passo: number;
  inicial: number;
}

/** Sem estoque com preço: a faixa histórica do material bruto. */
const SIMULADOR_SEM_ESTOQUE: FaixaSimulador = { min: 60_000, max: 400_000, passo: 5_000, inicial: 120_000 };

/**
 * A faixa do simulador DERIVADA do estoque (§5 do plano: "o simulador não
 * alcança o estoque" — `VALOR_MIN` fixo em 60.000 deixava de fora o HB20 de
 * 39.900, e o teto de 400.000 sobrava para um estoque que para em 149.900).
 * O passo é ~1/60 da amplitude, arredondado para valor de vitrine; o piso e
 * o teto cercam o carro mais barato e o mais caro; o ponto de partida é a
 * mediana do estoque. Todo carro do estoque é simulável.
 */
export function faixaDoSimulador(servicos: readonly { precoValor?: number }[]): FaixaSimulador {
  const valores = servicos
    .map((s) => s.precoValor)
    .filter((v): v is number => v !== undefined && Number.isFinite(v) && v > 0)
    .sort((a, b) => a - b);
  if (valores.length === 0) return SIMULADOR_SEM_ESTOQUE;
  const menor = valores[0];
  const maior = valores[valores.length - 1];
  const bruto = Math.max((maior - menor) / 60, maior / 200);
  const ordem = Math.pow(10, Math.floor(Math.log10(bruto)));
  const passo = [1, 2, 5, 10].map((f) => f * ordem).find((p) => p >= bruto) ?? 10 * ordem;
  const min = Math.max(passo, Math.floor(menor / passo) * passo);
  const max = Math.max(min + passo, Math.ceil(maior / passo) * passo);
  const mediana = valores[Math.floor((valores.length - 1) / 2)];
  const inicial = Math.min(max, Math.max(min, Math.round(mediana / passo) * passo));
  return { min, max, passo, inicial };
}

/** Parcela de um financiamento pela tabela Price (taxa em % a.m.). */
export function parcelaMensal(financiado: number, taxaPct: number, parcelas: number): number {
  if (financiado <= 0 || parcelas <= 0) return 0;
  const taxa = taxaPct / 100;
  if (taxa === 0) return financiado / parcelas;
  return (financiado * taxa) / (1 - Math.pow(1 + taxa, -parcelas));
}

/** Número inteiro pelo locale da demo, sem símbolo ("39.900", "39,900", "39’900"). */
export function formatarInteiro(valor: number, idioma: string | undefined): string {
  return Math.round(valor).toLocaleString(idioma ?? IDIOMA_PADRAO, { maximumFractionDigits: 0 });
}

/**
 * Evento que o botão "simular este carro" do card dispara para o
 * simulador, que mora em OUTRA seção (reordenável e ocultável à parte).
 * `detail` é o `precoValor` do carro. Sem JavaScript o botão é só um link
 * para `#simulador`.
 */
export const EVENTO_SIMULAR = "multimarcas:simular";

/** O carro do cliente, como digitado no formulário de troca. */
export interface CarroDaTroca {
  marca?: string;
  modelo?: string;
  ano?: string;
  km?: string;
}

/**
 * A mensagem de WhatsApp do formulário de troca (§3: "a avaliação vai com
 * o carro do cliente" — nenhum "Olá, quero informações" genérico onde há
 * contexto a mandar). Campo vazio não entra; a km ganha o separador do
 * locale e a unidade. Nada preenchido: a mensagem genérica, a mesma que o
 * formulário envia sem JavaScript.
 */
export function mensagemTroca(
  carro: CarroDaTroca,
  m: Pick<DemoMicrocopia, "trocaMensagem" | "trocaMensagemCarro">,
  idioma: string | undefined,
): string {
  const limpo = (v?: string) => v?.replace(/\s+/g, " ").trim() ?? "";
  const kmDigitos = limpo(carro.km).replace(/\D/g, "");
  const km = kmDigitos ? `${formatarInteiro(Number(kmDigitos), idioma)} km` : "";
  const nome = [limpo(carro.marca), limpo(carro.modelo), limpo(carro.ano)].filter(Boolean).join(" ");
  const descricao = [nome, km].filter(Boolean).join(", ");
  return descricao ? m.trocaMensagemCarro(descricao) : m.trocaMensagem;
}

/** Só os dígitos do WhatsApp — o destino do `action` do formulário sem JavaScript. */
export function digitosWhatsapp(whatsapp: string | undefined): string {
  return (whatsapp ?? "").replace(/\D/g, "");
}

/** Fundo e tinta de um avatar de iniciais. */
export interface CorDeAvatar {
  fundo: string;
  tinta: string;
}

/** Contraste mínimo das iniciais (15px bold não é "texto grande" pela WCAG). */
const CONTRASTE_AVATAR = 4.5;

/**
 * As cores dos avatares de depoimento DERIVADAS DA PALETA — não mais sete
 * hex cravados (`CORES_AVATAR`) com `text-white` por cima, um deles
 * (#A0741F) a 4,19:1 nas quatro paletas (§1/§2 do plano).
 *
 * Candidatas: destaque (com o `destaqueInk` da própria paleta),
 * acento secundário, acento terciário e texto. A tinta de cada uma é a
 * cor da paleta que mais contrasta (fundo ou texto) e, se nenhuma passa,
 * preto ou branco (`inkPara`); a candidata que nem assim chega a 4,5:1 sai
 * da lista. O par texto/fundo — o da leitura da página — sempre sobra.
 */
export function coresDoAvatar(paleta: ThemePaleta): CorDeAvatar[] {
  const hex = (c: string) => HEX_RE.test(c);
  const cores: CorDeAvatar[] = [];
  const somar = (fundo: string, tintas: string[]) => {
    if (!hex(fundo) || cores.some((c) => c.fundo.toLowerCase() === fundo.toLowerCase())) return;
    const candidatas = [...tintas.filter(hex), inkPara(fundo)];
    const melhor = candidatas.sort((a, b) => contrasteWcag(fundo, b) - contrasteWcag(fundo, a))[0];
    if (melhor && contrasteWcag(fundo, melhor) >= CONTRASTE_AVATAR) cores.push({ fundo, tinta: melhor });
  };
  somar(paleta.destaque, [paleta.destaqueInk]);
  somar(paleta.acentoSecundario, [paleta.fundo, paleta.texto]);
  somar(paleta.acentoTerciario, [paleta.fundo, paleta.texto]);
  somar(paleta.texto, [paleta.fundo]);
  return cores;
}

/** Avatar determinístico por autor — o mesmo autor, a mesma cor. */
export function corDoAutor(autor: string, cores: readonly CorDeAvatar[]): CorDeAvatar | undefined {
  let h = 0;
  for (let i = 0; i < autor.length; i++) h = (h * 31 + autor.charCodeAt(i)) | 0;
  return cores[Math.abs(h) % cores.length];
}

/**
 * A premissa de financiamento da skin: taxa de referência (% a.m.),
 * entrada e prazo com que o simulador ABRE — e a mesma com que a lista do
 * Pátio mostra a parcela de cada carro, para o número da lista ser o que a
 * pessoa reencontra ao clicar em "simular este carro".
 */
export const PREMISSA_FINANCIAMENTO = { taxa: 1.49, entrada: 0.2, parcelas: 48 } as const;
