/**
 * Extrai cidade e país do endereço formatado de um ESTABELECIMENTO
 * (Lead.endereco / Google formattedAddress). O país é sempre o último
 * segmento; a cidade é o segmento restante mais à direita, descartando
 * qualquer segmento puramente numérico (CEP) — como rua/número/bairro vêm
 * na frente, a cidade fica perto do fim, não do início. Em muitos países
 * (Suíça, Alemanha, Argentina...) o CEP não vira segmento próprio: vem
 * colado no início do MESMO segmento da cidade ("8001 Zürich", "C1425
 * Cdad. Autónoma de Buenos Aires") — esse token também é removido.
 *
 * NÃO é parseCidadePais (src/lib/regioes/ia.ts): aquele foi calibrado para
 * o texto curto de uma REGIÃO geocodificada ("Zürich, Suíça"), pegando a
 * PRIMEIRA parte como cidade. Aqui o endereço é de um lugar específico.
 */
const SEGMENTO_NUMERICO = /^[\d\s-]+$/;
const PREFIXO_CEP = /^[A-Za-z]?\d{4,6}(?:-\d{3,4})?\s+/;

export interface EnderecoLocalizacao {
  cidade?: string;
  /** Último segmento do endereço, em pt-BR (Places API sempre chamada com languageCode=pt-BR). */
  pais?: string;
}

export function cidadeDoEndereco(endereco: string): EnderecoLocalizacao {
  const segmentos = endereco
    .split(",")
    .map((parte) => parte.trim())
    .filter(Boolean);

  if (segmentos.length < 2) return {};

  const pais = segmentos.at(-1);
  const semPais = segmentos.slice(0, -1);
  const semCep = semPais.filter((segmento) => !SEGMENTO_NUMERICO.test(segmento));

  const cidadeBruta = semCep.at(-1);
  const cidade = cidadeBruta?.replace(PREFIXO_CEP, "").trim() || cidadeBruta;

  return { cidade, pais };
}
