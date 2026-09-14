import type { SkinDefinition } from "@/lib/demos/types";

import { LANCHERIA2_SECOES } from "./secoes";
import { Lancheria2 } from "./Skin";
import { LANCHERIA2_VARIANTES } from "./variantes";

/**
 * A entrada de registro da `lancheria-2`. UMA skin com QUATRO variantes —
 * `themePresets`, `themeDefault` e `demoDataExemplo` são derivados delas,
 * porque a variante ocupa o lugar do preset de tema (ver
 * `SkinVariante` em lib/demos/types.ts).
 */
export const LANCHERIA_2: SkinDefinition = {
  id: "lancheria-2",
  nicho: "lancheria",
  nome: "Lancheria 2",
  descricao:
    "Lancheria com raio-x do lanche: o cliente abre a composição, tira e põe camada e vê o preço mudar. Quatro variantes — Meia-Noite, Diner, Prático e Cantina — sobre o mesmo motor calibrado.",
  componente: Lancheria2,
  variantes: LANCHERIA2_VARIANTES,
  themeDefault: LANCHERIA2_VARIANTES[0].theme,
  themePresets: LANCHERIA2_VARIANTES.map((v) => v.theme),
  demoDataExemplo: LANCHERIA2_VARIANTES[0].exemplo,
  secoes: LANCHERIA2_SECOES,
  // O componente vem do pacote calibrado e monta as próprias seções: ele
  // marca `data-d-secao` (a âncora de captura), mas não tem wrapper de
  // entrada onde pendurar animação por seção. Sem isto o painel Estrutura
  // mostraria um botão que não faz nada.
  animacaoPorSecao: false,
  localeFixo: { idioma: "pt-BR", moeda: "BRL" },
  // O título hero é tipografia calibrada do pacote: sem slider de escala.
  heroEscalaLimites: { min: 1, max: 1 },
  thumbnail: LANCHERIA2_VARIANTES[0].thumbnail,
  // Sem `fontesRecomendadas`: a tipografia vem da folha de fontes da
  // variante (`Tema.folhaFontes`), não da lista curada da Forja.
};
