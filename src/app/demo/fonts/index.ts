/**
 * Fontes das skins de demo. `demoCoreFontsClassName` cobre as fontes
 * sempre presentes nos presets (self-hosted no build, sem chamada
 * externa); `resolveExtraFontClassNames` carrega sob demanda só a fonte
 * curada que o editor escolheu (ver ./core.ts e ./registry.ts).
 */
export { demoCoreFontsClassName } from "./core";
export { resolveExtraFontClassNames } from "./registry";
