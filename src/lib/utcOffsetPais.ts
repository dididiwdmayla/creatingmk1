/**
 * Deslocamento UTC (minutos) aproximado do PAÍS do endereço — fallback usado
 * só quando o enriquecimento não trouxe `horarios.utcOffsetMinutes` (Google
 * Places). Mesmas chaves de país (nome em pt-BR, como Places/Geocoding
 * devolvem) de `@/lib/idioma` e `@/lib/moeda`.
 *
 * País com mais de um fuso (Brasil, EUA, Canadá, Austrália...) usa o fuso
 * PADRÃO (sem horário de verão) de maior peso populacional/comercial — a
 * mesma aproximação deliberada do mapa de idioma/moeda: aponta pro caso mais
 * provável, nunca tenta ser exato. País sem entrada aqui → undefined, e o
 * chamador (`@/lib/leads/janelaContato`) prefere não mostrar hora nenhuma a
 * arriscar mostrar uma errada.
 */
export const UTC_OFFSET_MINUTOS_POR_PAIS: Record<string, number> = {
  brasil: -180, // horário de Brasília — cobre a maior parte da população/área
  portugal: 0,
  angola: 60,
  moçambique: 120,
  "estados unidos": -300, // hora do leste (ET, padrão sem DST)
  "reino unido": 0,
  irlanda: 0,
  austrália: 600, // hora do leste (AEST, padrão sem DST)
  "nova zelândia": 720,
  canadá: -300, // hora do leste (ET, padrão sem DST)
  espanha: 60,
  méxico: -360,
  argentina: -180,
  chile: -240,
  colômbia: -300,
  peru: -300,
  uruguai: -180,
  paraguai: -240,
  bolívia: -240,
  equador: -300,
  venezuela: -240,
  "costa rica": -360,
  panamá: -300,
  guatemala: -360,
  honduras: -360,
  nicarágua: -360,
  "el salvador": -360,
  "república dominicana": -240,
  frança: 60,
  bélgica: 60,
  suíça: 60,
  alemanha: 60,
  áustria: 60,
  itália: 60,
  holanda: 60,
  "países baixos": 60,
};

/** Deslocamento UTC a partir do NOME do país (pt-BR, case-insensitive). Sem país reconhecido → undefined. */
export function utcOffsetDoPais(pais: string | undefined): number | undefined {
  if (!pais) return undefined;
  return UTC_OFFSET_MINUTOS_POR_PAIS[pais.trim().toLowerCase()];
}
