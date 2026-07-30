import { CORE_FONT_IDS } from "./core";

/**
 * Fontes extras da lista curada (lib/demos/fontes.ts) que NÃO são o
 * default de nenhum preset — só entram no bundle quando o editor
 * (`tema.fonteDisplay`/`fonteCorpo`) escolhe uma delas. Cada loader é um
 * `import()` dinâmico: o chunk (CSS + arquivo da fonte) só é buscado
 * quando a função roda, então demos que não usam a fonte nunca pagam
 * o custo dela — nem preload, nem download.
 */
const DYNAMIC_FONT_LOADERS: Record<string, () => Promise<string>> = {
  poppins: () => import("./dynamic/poppins").then((m) => m.default.variable),
  lora: () => import("./dynamic/lora").then((m) => m.default.variable),
  abril: () => import("./dynamic/abril").then((m) => m.default.variable),
  "archivo-black": () => import("./dynamic/archivo-black").then((m) => m.default.variable),
  cinzel: () => import("./dynamic/cinzel").then((m) => m.default.variable),
  "dm-sans": () => import("./dynamic/dm-sans").then((m) => m.default.variable),
  josefin: () => import("./dynamic/josefin").then((m) => m.default.variable),
  "libre-baskerville": () =>
    import("./dynamic/libre-baskerville").then((m) => m.default.variable),
  merriweather: () => import("./dynamic/merriweather").then((m) => m.default.variable),
  montserrat: () => import("./dynamic/montserrat").then((m) => m.default.variable),
};

/**
 * Resolve as classes CSS var das fontes escolhidas (ids de fonteDisplay/
 * fonteCorpo), pulando ids ausentes/desconhecidos e os já cobertos pelo
 * pacote core (evita import duplicado — a var já existe na página).
 */
export async function resolveExtraFontClassNames(
  ids: Array<string | undefined>,
): Promise<string> {
  const unicos = [
    ...new Set(
      ids.filter(
        (id): id is string =>
          typeof id === "string" && id in DYNAMIC_FONT_LOADERS && !CORE_FONT_IDS.includes(id),
      ),
    ),
  ];
  const classes = await Promise.all(unicos.map((id) => DYNAMIC_FONT_LOADERS[id]()));
  return classes.join(" ");
}
