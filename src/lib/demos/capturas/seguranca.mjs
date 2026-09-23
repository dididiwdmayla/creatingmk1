/**
 * O header que o motor de captura manda pra pular a INTRO da demo pública
 * — ver "Intro e captura" em ARCHITECTURE.md. Mora num `.mjs` pelo mesmo
 * motivo de `previa.mjs`/`alvo.mjs`: é lido tanto pela rota pública
 * (`app/demo/comum.tsx`, TypeScript) quanto pelo motor de captura
 * (`scripts/capturas.mjs`, que não compila TypeScript) — um nome só, nos
 * dois lados.
 *
 * Só o NOME do header mora aqui. O VALOR (`CAPTURA_SECRET`) é variável de
 * ambiente, nunca uma constante de código — ver .env.example.
 */
export const CAPTURA_HEADER = "x-radar-captura";
