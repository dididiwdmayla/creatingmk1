import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

/**
 * CUSTO DO CROMO, travado (ver ARCHITECTURE.md).
 *
 * A plataforma fica aberta o dia inteiro. Três regras, e as três dão para
 * cobrar lendo o CSS:
 *
 *   1. nenhuma animação CONTÍNUA no cromo da interface;
 *   2. nada de desfoque animado junto com transformação (a combinação que
 *      derrubou o editor de demos a 9 fps — ver "Custo por quadro dos
 *      efeitos");
 *   3. a iridescência é deslocamento LENTO de matiz ou nada. Aqui é nada:
 *      gradiente multi-matiz parado.
 *
 * O par em tempo de execução é `qa-plataforma.mjs --so=custo`, que conta as
 * animações vivas no DOM real, e `--so=fps`, que mede o quadro em celular
 * com CPU 4× navegando entre as abas.
 */

const CSS = fs.readFileSync(path.join(process.cwd(), "src/app/globals.css"), "utf8");
const NAV = fs.readFileSync(path.join(process.cwd(), "src/components/Nav.tsx"), "utf8");
const META_FAIXA = fs.readFileSync(
  path.join(process.cwd(), "src/components/MetaFaixa.tsx"),
  "utf8",
);

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

/**
 * Animações infinitas permitidas — todas de CONTEÚDO e todas condicionais,
 * nenhuma no cromo:
 *   - `.radar-sweep::before`: o mostrador só existe enquanto uma carga está
 *     em curso (painel/leads/login), some quando o dado chega;
 *   - `.pulse-*`: só aparece quando o meter está perto do teto ou no limite,
 *     e o estado também vem como palavra ("Perto do teto"/"No limite").
 */
const ANIMACAO_INFINITA_PERMITIDA = new Set([
  ".radar-sweep::before",
  ".pulse-critical",
  ".pulse-warning",
]);

/** Classes que compõem o cromo (header, barra de metas, navegação inferior). */
const CLASSES_DE_CROMO = [".cromo-linha", ".cromo-linha-baixo", ".cromo-linha-cima", ".cromo-aba-ativa", ".cromo-realce"];

describe("custo do cromo", () => {
  it("nenhuma animação infinita fora da lista de conteúdo permitida", () => {
    const infinitas = regras(CSS)
      .filter(({ corpo }) => /animation:[^;]*infinite/.test(corpo))
      .map(({ seletor }) => seletor);

    expect(infinitas.length).toBeGreaterThan(0); // o teste enxerga alguma
    expect(infinitas.filter((s) => !ANIMACAO_INFINITA_PERMITIDA.has(s))).toEqual([]);
  });

  it("nenhuma classe de cromo anima nada", () => {
    for (const { seletor, corpo } of regras(CSS)) {
      if (!CLASSES_DE_CROMO.some((c) => seletor.startsWith(c))) continue;
      expect(corpo, seletor).not.toMatch(/animation\s*:/);
      expect(corpo, seletor).not.toMatch(/transition\s*:/);
    }
  });

  it("o cromo em JSX não usa utilitário de animação contínua do Tailwind", () => {
    // `animate-ping`/`animate-pulse`/`animate-spin`/`animate-bounce` são
    // infinitos por definição. O ponto do RADAR no header já teve um.
    //
    // Comentários saem antes da busca: a própria explicação de POR QUE a
    // animação foi removida cita o nome da classe, e sem isto o teste
    // reprovaria o arquivo pelo comentário que documenta a correção.
    const semComentarios = (fonte: string) =>
      fonte.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

    for (const [nome, fonte] of [
      ["Nav.tsx", NAV],
      ["MetaFaixa.tsx", META_FAIXA],
    ] as const) {
      expect(semComentarios(fonte), nome).not.toMatch(/animate-(ping|pulse|spin|bounce)/);
    }
  });

  it("a iridescência é ESTÁTICA: nenhum keyframe mexe nos tokens do arco", () => {
    const blocosKeyframes = CSS.match(/@keyframes[^{]*\{(?:[^{}]*\{[^{}]*\})*[^{}]*\}/g) ?? [];
    expect(blocosKeyframes.length).toBeGreaterThan(0);
    for (const bloco of blocosKeyframes) {
      expect(bloco).not.toMatch(/--iris-/);
      expect(bloco).not.toMatch(/gradient\(/);
      expect(bloco).not.toMatch(/filter\s*:/);
    }
  });

  it("nenhum desfoque animado junto de transformação", () => {
    // A combinação `filter: blur()` + `transform` animado é o que derrubou o
    // preview do editor a 9 fps. No cromo da plataforma não existe blur
    // nenhum — nem estático.
    for (const { seletor, corpo } of regras(CSS)) {
      if (!/blur\(/.test(corpo)) continue;
      expect(
        /animation\s*:|transition\s*:[^;]*(transform|filter)/.test(corpo),
        `${seletor} combina blur com animação/transição`,
      ).toBe(false);
    }
  });
});
