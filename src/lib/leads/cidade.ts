/**
 * Extrai a cidade do endereço formatado de um ESTABELECIMENTO (Lead.endereco
 * / Google formattedAddress) — descarta o último segmento (país) e qualquer
 * segmento puramente numérico (CEP), devolvendo o segmento restante mais à
 * direita, como string livre.
 *
 * NÃO é parseCidadePais (src/lib/regioes/ia.ts): aquele foi calibrado para o
 * texto curto de uma REGIÃO geocodificada ("Zürich, Suíça"), pegando a
 * PRIMEIRA parte como cidade. Aqui o endereço é de um lugar específico, com
 * rua/número/bairro na frente — a cidade fica perto do fim, não do início.
 */
const SEGMENTO_NUMERICO = /^[\d\s-]+$/;

export function cidadeDoEndereco(endereco: string): string | undefined {
  const segmentos = endereco
    .split(",")
    .map((parte) => parte.trim())
    .filter(Boolean);

  if (segmentos.length < 2) return undefined;

  const semPais = segmentos.slice(0, -1);
  const semCep = semPais.filter((segmento) => !SEGMENTO_NUMERICO.test(segmento));

  return semCep.at(-1);
}
