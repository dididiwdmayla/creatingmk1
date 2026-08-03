import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

/**
 * REGRA DE LEGIBILIDADE, travada (ver ARCHITECTURE.md).
 *
 * Gradiente e iridescência só podem viver em borda, cabeçalho, navegação
 * inferior, estado ativo e realce — nunca sob texto de leitura, que fica em
 * superfície SÓLIDA. O comentário no `globals.css` diz isso; este teste é o
 * que impede que ele vire ficção na próxima vez que alguém quiser "só um
 * gradientezinho no card".
 *
 * O par deste teste é `qa-plataforma.mjs --so=legibilidade`, que varre o DOM
 * REAL de cada aba em cada tema. Os dois são necessários e nenhum substitui o
 * outro: este pega a regra nova antes de existir tela; aquele pega o caso em
 * que uma classe permitida foi aplicada no lugar errado.
 */

const CSS = fs.readFileSync(
  path.join(process.cwd(), "src/app/globals.css"),
  "utf8",
);

/**
 * Onde gradiente PODE existir, por categoria. Qualquer seletor fora desta
 * lista reprova — e acrescentar um aqui obriga a justificar em qual das
 * categorias ele cai.
 */
const SELETORES_PERMITIDOS = new Set([
  // 1-5. o cromo iridescente dos temas: bordas, cabeçalho, navegação
  // inferior, estado ativo e realce. Todos são faixas de 1–2px.
  ".cromo-linha::after",
  ".cromo-aba-ativa",
  ".cromo-realce",

  // Declaração do token `--iris-linha` — guarda a rampa, não pinta nada.
  ":root",
  ':root[data-theme="claro"]',
  ':root[data-theme="acido"]',
  ':root[data-theme="vapor"]',
  ':root[data-theme="prisma"]',

  // Decoração SEM texto dentro: o mostrador de radar do painel é um círculo
  // de anéis com um setor girando, e nada é lido por cima dele.
  ".radar-sweep",
  ".radar-sweep::before",

  // Scrim POR CIMA, não fundo por baixo: a listra de descarte é um ::after
  // que pinta depois do texto, e o esmaecimento é deliberado ("este lead foi
  // descartado"). A regra fala de gradiente SOB texto de leitura; isto é o
  // caso oposto, e de-ênfase intencional.
  ".lead-descartado::after",
]);

/**
 * Regras (seletor + corpo) do arquivo. Parse deliberadamente bobo — chaves
 * balanceadas em um nível — porque o `globals.css` é um arquivo plano de
 * regras e @-rules simples; nada aqui precisa de um parser de CSS de verdade.
 */
function regras(css: string): Array<{ seletor: string; corpo: string }> {
  const saida: Array<{ seletor: string; corpo: string }> = [];
  const semComentarios = css.replace(/\/\*[\s\S]*?\*\//g, "");
  const re = /([^{}]+)\{([^{}]*)\}/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(semComentarios)) !== null) {
    const seletor = m[1].trim().split("\n").pop()!.trim();
    if (!seletor || seletor.startsWith("@")) continue;
    saida.push({ seletor, corpo: m[2] });
  }
  return saida;
}

/** Uma declaração que PINTA gradiente (não uma que só guarda o token). */
function pintaGradiente(corpo: string): boolean {
  return /(?:^|[;\s])(background|background-image|border-image)\s*:[^;]*(?:gradient\(|var\(--iris-linha\))/m.test(
    corpo,
  );
}

describe("regra de legibilidade do globals.css", () => {
  it("todo gradiente vive num dos cinco lugares permitidos", () => {
    const fora = regras(CSS)
      .filter(({ corpo }) => pintaGradiente(corpo))
      .map(({ seletor }) => seletor)
      .filter((seletor) => !SELETORES_PERMITIDOS.has(seletor));

    expect(fora).toEqual([]);
  });

  it("o teste enxerga gradiente de verdade (senão passaria contando zero)", () => {
    // Guarda contra o teste que "passa" porque o parser não achou nada.
    const comGradiente = regras(CSS).filter(({ corpo }) => pintaGradiente(corpo));
    expect(comGradiente.length).toBeGreaterThanOrEqual(4);
    expect(comGradiente.map((r) => r.seletor)).toContain(".cromo-linha::after");
  });

  it("reprova um gradiente posto num container de leitura", () => {
    const cssRuim = `${CSS}\n.card-de-leitura { background-image: linear-gradient(90deg, red, blue); }\n`;
    const fora = regras(cssRuim)
      .filter(({ corpo }) => pintaGradiente(corpo))
      .map(({ seletor }) => seletor)
      .filter((seletor) => !SELETORES_PERMITIDOS.has(seletor));

    expect(fora).toContain(".card-de-leitura");
  });

  it("o plano da página é cor chapada (nada de vinheta sob o texto)", () => {
    const body = regras(CSS).find((r) => r.seletor === "body");
    expect(body).toBeDefined();
    expect(body!.corpo).not.toMatch(/gradient\(/);
  });

  it("as superfícies de leitura são cor chapada em todos os temas", () => {
    // --surface e --background carregam o texto; se um dia virarem gradiente,
    // a regra cai por outro caminho que o teste acima não cobriria.
    for (const { seletor, corpo } of regras(CSS)) {
      if (!seletor.startsWith(":root")) continue;
      for (const token of ["--surface", "--background", "--surface-2", "--background-2"]) {
        const decl = new RegExp(`${token}\\s*:\\s*([^;]+);`).exec(corpo)?.[1];
        if (decl === undefined) continue;
        expect(decl, `${seletor} ${token}`).toMatch(/^#[0-9a-f]{6}$/i);
      }
    }
  });
});
