import { idiomaDoPais } from "@/lib/idioma";
import { utcOffsetDoPais } from "@/lib/utcOffsetPais";

/**
 * PAÍSES CANDIDATOS À PROSPECÇÃO — a lista curta que alimenta a tela
 * `/mundo` ("onde no mundo vale prospectar agora"). Vive em `/config/app`,
 * editável sem deploy como `janelasContato` e `capturas.ancoras`.
 *
 * O critério de entrada é UM: **WhatsApp ser canal padrão de contato
 * comercial** por lá. É por isso que Estados Unidos e Canadá ficam de fora
 * mesmo tendo mercado caro — abordagem fria por WhatsApp não é hábito
 * local, e um país nessa lista é um país que a tela vai mandar prospectar.
 *
 * Cada país guarda só o que a tela precisa e que não dá pra derivar do
 * lead (a tela existe ANTES de existir lead naquele país): fuso, idioma(s)
 * e o índice de mercado. Os defaults de fuso e idioma são DERIVADOS dos
 * mapas que já existem (`@/lib/utcOffsetPais`, `@/lib/idioma`) — nenhuma
 * tabela paralela a manter; o que é opinião nova aqui é só o índice base e
 * a escolha dos países.
 */

export interface PaisProspeccao {
  /** ISO 3166-1 alpha-2, MAIÚSCULO — é dele que sai a bandeira (ver `bandeiraDoPais`). */
  codigo: string;
  /**
   * Nome em pt-BR — a MESMA chave dos mapas de idioma/fuso e o mesmo texto
   * que o Places devolve no fim de `Lead.endereco` (as duas APIs são sempre
   * chamadas com `language=pt-BR`). É por essa igualdade que a tela
   * consegue casar lead → país sem nenhum código de país no doc do lead.
   */
  nome: string;
  /** Deslocamento UTC em minutos (fuso PADRÃO do país, sem horário de verão). */
  utcOffsetMinutos: number;
  /**
   * Idioma(s) de contato comercial, BCP-47 — o primeiro é o principal (é
   * ele que decide a posição do país na ordenação por idioma da tela).
   */
  idiomas: string[];
  /**
   * Índice de mercado do país na MESMA escala de `/regioes` (cidade média
   * do interior do Brasil = 1.0). É um ponto de partida grosseiro e
   * editável: quando já existe região daquele país cacheada em `/regioes`,
   * a tela prefere a média das cidades REAIS (ver `indiceDoPais`).
   */
  indice: number;
}

export type PaisesProspeccaoConfig = PaisProspeccao[];

/**
 * Índice base por país (escala de `/regioes`: interior do Brasil = 1.0).
 * Chute inicial deliberado — mesma postura de `DEFAULT_JANELAS_CONTATO`:
 * a tabela existe pra ser corrigida na tela, não pra estar certa de
 * fábrica. Assim que uma cidade daquele país passa pelo geocoding, o
 * índice gerado por IA em `/regioes` vale mais que este número.
 */
const INDICE_BASE: Record<string, number> = {
  Brasil: 1.0,
  Portugal: 1.6,
  Espanha: 1.9,
  Itália: 2.0,
  Suíça: 3.5,
  México: 1.2,
  Colômbia: 1.0,
  Argentina: 1.0,
  Chile: 1.3,
  Peru: 0.9,
  Uruguai: 1.3,
  Paraguai: 0.8,
  Bolívia: 0.7,
  Equador: 0.9,
  "Costa Rica": 1.2,
};

/**
 * Idiomas além do que `idiomaDoPais` devolve. Só a Suíça precisa: o mapa
 * de idioma aponta um alvo só por país (o alemão, lá), e quem prospecta
 * Genebra ou Lugano fala outra língua. A ordem importa — o primeiro manda
 * na ordenação da tela.
 */
const IDIOMAS_EXTRA: Record<string, string[]> = {
  Suíça: ["de-CH", "fr-CH", "it-CH"],
};

function pais(codigo: string, nome: string): PaisProspeccao {
  const offset = utcOffsetDoPais(nome);
  if (offset === undefined) {
    // Erro de digitação no nome do país sairia como país sem fuso — e país
    // sem fuso é país que nunca aparece na tela, calado. Melhor explodir na
    // carga do módulo.
    throw new Error(`país "${nome}" não está em UTC_OFFSET_MINUTOS_POR_PAIS`);
  }
  return {
    codigo,
    nome,
    utcOffsetMinutos: offset,
    idiomas: IDIOMAS_EXTRA[nome] ?? [idiomaDoPais(nome)],
    indice: INDICE_BASE[nome] ?? 1,
  };
}

/**
 * Os 15 de partida: onde o WhatsApp é canal padrão de contato comercial e
 * o fuso ainda deixa a madrugada brasileira valer alguma coisa (a Europa
 * de manhã, a América Latina no fim da madrugada).
 */
export const DEFAULT_PAISES_PROSPECCAO: PaisesProspeccaoConfig = [
  pais("BR", "Brasil"),
  pais("PT", "Portugal"),
  pais("ES", "Espanha"),
  pais("IT", "Itália"),
  pais("CH", "Suíça"),
  pais("MX", "México"),
  pais("CO", "Colômbia"),
  pais("AR", "Argentina"),
  pais("CL", "Chile"),
  pais("PE", "Peru"),
  pais("UY", "Uruguai"),
  pais("PY", "Paraguai"),
  pais("BO", "Bolívia"),
  pais("EC", "Equador"),
  pais("CR", "Costa Rica"),
];

/** Normalização do nome do país para casar config × endereço do lead. */
export function normalizarPais(nome: string): string {
  return nome.trim().toLowerCase();
}

/**
 * Bandeira do código ISO alpha-2, montada com os REGIONAL INDICATOR
 * SYMBOLS (🇧🇷 = "BR" deslocado pro bloco U+1F1E6). Sem lista de emojis a
 * manter e sem imagem a servir; num sistema sem fonte de bandeira o
 * navegador desenha as duas letras, que continuam dizendo o país.
 */
export function bandeiraDoPais(codigo: string): string {
  const base = 0x1f1e6;
  return [...codigo.trim().toUpperCase()]
    .map((letra) => String.fromCodePoint(base + letra.charCodeAt(0) - 65))
    .join("");
}

const CODIGO_ISO = /^[A-Z]{2}$/;
/** BCP-47 curto: "es" ou "es-AR"/"de-CH" — o que o resto do app usa. */
const IDIOMA_BCP47 = /^[a-z]{2}(-[A-Za-z0-9]{2,4})?$/;

/**
 * Valida o pedaço `paisesProspeccao` de um patch de config, no mesmo
 * espírito de `validarJanelasContato`: campo desconhecido, código fora do
 * ISO, fuso impossível e país repetido são ERRO, não silêncio. País
 * repetido em especial: a tela mostraria a mesma linha duas vezes e a
 * contagem de leads sairia dobrada.
 */
export function validarPaisesProspeccao(
  valor: unknown,
  caminho: string,
  problemas: string[],
): void {
  if (!Array.isArray(valor)) {
    problemas.push(`${caminho} deve ser uma lista de países`);
    return;
  }
  const vistos = new Set<string>();
  valor.forEach((item, i) => {
    const base = `${caminho}[${i}]`;
    if (typeof item !== "object" || item === null || Array.isArray(item)) {
      problemas.push(`${base} deve ser um objeto { codigo, nome, utcOffsetMinutos, idiomas, indice }`);
      return;
    }
    const entrada = item as Record<string, unknown>;
    for (const chave of Object.keys(entrada)) {
      if (!["codigo", "nome", "utcOffsetMinutos", "idiomas", "indice"].includes(chave)) {
        problemas.push(`${base}.${chave} não é um campo conhecido`);
      }
    }
    if (typeof entrada.codigo !== "string" || !CODIGO_ISO.test(entrada.codigo)) {
      problemas.push(`${base}.codigo deve ser o código ISO de 2 letras maiúsculas (ex.: "PT")`);
    }
    if (typeof entrada.nome !== "string" || !entrada.nome.trim()) {
      problemas.push(`${base}.nome deve ser o nome do país em português`);
    } else {
      const chave = normalizarPais(entrada.nome);
      if (vistos.has(chave)) problemas.push(`${base}.nome: "${entrada.nome}" aparece mais de uma vez`);
      vistos.add(chave);
    }
    const offset = entrada.utcOffsetMinutos;
    if (
      typeof offset !== "number" ||
      !Number.isInteger(offset) ||
      offset < -12 * 60 ||
      offset > 14 * 60
    ) {
      problemas.push(`${base}.utcOffsetMinutos deve ser inteiro entre -720 e 840 (minutos)`);
    }
    if (!Array.isArray(entrada.idiomas) || entrada.idiomas.length === 0) {
      problemas.push(`${base}.idiomas deve ser uma lista com ao menos um idioma`);
    } else {
      entrada.idiomas.forEach((idioma, j) => {
        if (typeof idioma !== "string" || !IDIOMA_BCP47.test(idioma)) {
          problemas.push(`${base}.idiomas[${j}] deve ser um código BCP-47 (ex.: "es-AR")`);
        }
      });
    }
    if (
      typeof entrada.indice !== "number" ||
      !Number.isFinite(entrada.indice) ||
      entrada.indice <= 0
    ) {
      problemas.push(`${base}.indice deve ser número > 0`);
    }
  });
}
