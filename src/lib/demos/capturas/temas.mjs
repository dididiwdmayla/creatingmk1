/**
 * Alvos dos laços colapso, barra e avulsa: skin × preset/variante.
 * As próximas migrações saem de PRESETS_SEM_VARIANTES e entram em
 * VARIANTES_POR_SKIN. O teste exige equivalência exata com o registro.
 */
import { VARIANTES_POR_SKIN } from "./variantes.mjs";

export const PRESETS_SEM_VARIANTES = {
  "barbearia2-sul": ["musgo", "ardosia", "marfim", "ouro-da-meia-noite"],
  "tatuagem-pigmento-vivo": ["aquarela", "boreal", "meia-noite", "terra"],
  "imobiliaria-curada": ["terracota", "salvia", "argila", "noturno"],
  "petshop-focinho-feliz": ["pastel", "menta", "blush", "meia-noite"],
};

export const TEMAS_POR_SKIN = { ...PRESETS_SEM_VARIANTES, ...VARIANTES_POR_SKIN };
export const ALVOS_QA = Object.entries(TEMAS_POR_SKIN).flatMap(([skinId, temas]) =>
  temas.map(preset => ({ skinId, preset, id: `${skinId}--${preset}` })),
);
