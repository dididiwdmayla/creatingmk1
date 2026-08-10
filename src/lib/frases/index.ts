export { montarConjuntos } from "./listagem";
export {
  avancarRotacao,
  conjuntoVazio,
  getConjunto,
  listConjuntos,
  salvarConjunto,
  salvarTraducao,
} from "./repo";
export {
  fraseAtual,
  frasesEfetivas,
  normalizarSlots,
  posicaoAtual,
  proximoIndice,
  slotAtual,
} from "./rotacao";
export {
  estadoTraducao,
  montarTraducao,
  slotsATraduzir,
  textoDoSlot,
  type EstadoTraducao,
} from "./traducao";
export {
  FRASES_COLLECTION,
  FRASES_SLOTS,
  FRASE_MAX,
  type ConjuntoSkin,
  type FrasesProspeccao,
  type TraducaoFrases,
} from "./types";
export { validarAlvoRotacao, validarConjuntoPatch, type ConjuntoPatch } from "./validar";
