/**
 * Fontes DEFAULT de cada variante da "Tatuagem Pigmento Vivo" — ver
 * `SkinDefinition.fontesVariante` em `lib/demos/types.ts` e o README de
 * `src/app/demo/fonts/local/pigmento/`.
 *
 * Cada carregador é um `import()` dinâmico: só o par de `.woff2` da
 * variante ATIVA entra no bundle (e no HTML) de uma requisição — as outras
 * três nunca chegam a ser buscadas, nem pré-carregadas. Mesmo padrão de
 * `resolveExtraFontClassNames` (`app/demo/fonts/registry.ts`), na
 * granularidade de VARIANTE em vez de fonte avulsa escolhida no editor.
 */
const CARREGADORES: Record<string, () => Promise<string>> = {
  aquarela: () =>
    import("@/app/demo/fonts/local/pigmento/aquarela").then((m) => m.pigmentoFontClassName),
  boreal: () =>
    import("@/app/demo/fonts/local/pigmento/boreal").then((m) => m.pigmentoFontClassName),
  "meia-noite": () =>
    import("@/app/demo/fonts/local/pigmento/meia-noite").then((m) => m.pigmentoFontClassName),
  terra: () =>
    import("@/app/demo/fonts/local/pigmento/terra").then((m) => m.pigmentoFontClassName),
};

/** Id da variante default — mesma tolerância de `varianteEfetiva` (id ausente/desconhecido cai nela). */
const VARIANTE_PADRAO = "aquarela";

export async function fontesTatuagemPigmentoVivo(themeId: string | undefined): Promise<string> {
  const carregar = (themeId && CARREGADORES[themeId]) || CARREGADORES[VARIANTE_PADRAO];
  return carregar();
}
