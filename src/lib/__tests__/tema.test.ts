import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { TEMAS_APP, TEMAS_META, TEMA_PADRAO, temaOuPadrao, temaValido } from "@/lib/tema";

const CSS = fs.readFileSync(path.join(process.cwd(), "src/app/globals.css"), "utf8");

/** Bloco de um tema no globals.css (`:root` para o escuro, que é o padrão). */
function blocoDoTema(id: string): string {
  const seletor = id === TEMA_PADRAO ? ":root" : `:root[data-theme="${id}"]`;
  const i = CSS.indexOf(`${seletor} {`);
  expect(i, `bloco CSS de "${id}"`).toBeGreaterThanOrEqual(0);
  return CSS.slice(i, CSS.indexOf("\n}", i));
}

describe("registro de temas", () => {
  it("todo tema da lista tem metadados", () => {
    for (const id of TEMAS_APP) {
      expect(TEMAS_META[id], id).toBeDefined();
      expect(TEMAS_META[id].id).toBe(id);
      expect(TEMAS_META[id].nome.length).toBeGreaterThan(0);
    }
  });

  it("todo tema tem um bloco no globals.css", () => {
    for (const id of TEMAS_APP) expect(blocoDoTema(id).length).toBeGreaterThan(0);
  });

  /**
   * A cor da barra do navegador é HTML (meta tag), não CSS — nada consegue
   * ler uma custom property no servidor, então `TemaMeta.barra` DUPLICA a
   * `--surface` do tema. Duplicata sem guarda vira divergência silenciosa:
   * alguém ajusta a surface no CSS, a barra do navegador continua na cor
   * antiga e ninguém percebe porque só aparece na moldura do celular.
   */
  it("a cor da barra do navegador é a --surface do próprio tema", () => {
    for (const id of TEMAS_APP) {
      const surface = /--surface:\s*(#[0-9a-f]{6})/i.exec(blocoDoTema(id))?.[1];
      expect(surface, `--surface de "${id}"`).toBeDefined();
      expect(TEMAS_META[id].barra.toLowerCase(), `barra de "${id}"`).toBe(
        surface!.toLowerCase(),
      );
    }
  });

  it("cada tema tem glifo próprio (o canal que não é cor)", () => {
    const glifos = TEMAS_APP.map((id) => TEMAS_META[id].glifo);
    expect(new Set(glifos).size).toBe(glifos.length);
  });

  it("temaValido aceita só a lista, temaOuPadrao tolera lixo", () => {
    for (const id of TEMAS_APP) expect(temaValido(id)).toBe(true);
    for (const lixo of ["light", "dark", "", null, 7, undefined, {}]) {
      expect(temaValido(lixo)).toBe(false);
      expect(temaOuPadrao(lixo)).toBe(TEMA_PADRAO);
    }
  });
});
