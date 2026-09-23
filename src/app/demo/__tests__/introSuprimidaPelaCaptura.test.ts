import { describe, expect, it, vi } from "vitest";

// next/font/google exige o plugin SWC do Next (não roda sob vitest puro) —
// `../comum` importa `./fonts` no topo do módulo mesmo só pra esta função
// pura; irrelevante pro que este teste verifica (mesmo stub das suítes de
// rota pública, ver [leadId]/__tests__/page.test.tsx).
vi.mock("../fonts", () => ({
  demoCoreFontsClassName: "fonts-stub",
  resolveExtraFontClassNames: async () => "",
}));

const { introSuprimidaPelaCaptura } = await import("../comum");

/**
 * `introSuprimidaPelaCaptura` isolada de `headers()`/`resolverDemo` de
 * propósito (ver a doc dela em ../comum.tsx) — os dois casos que importam
 * (fail-closed e caminho feliz) se testam sem mockar `next/headers`. O
 * caminho completo (header → `theme.intro`) é __tests__/comum.test.tsx.
 */
describe("introSuprimidaPelaCaptura", () => {
  it("fail-closed: sem CAPTURA_SECRET no servidor, o header é ignorado mesmo se correto", () => {
    expect(introSuprimidaPelaCaptura("segredo-certo", undefined)).toBe(false);
  });

  it("sem header nenhum, mesmo com CAPTURA_SECRET configurada", () => {
    expect(introSuprimidaPelaCaptura(null, "segredo-certo")).toBe(false);
  });

  it("header errado não suprime", () => {
    expect(introSuprimidaPelaCaptura("segredo-errado", "segredo-certo")).toBe(false);
  });

  it("header vazio não suprime, mesmo com segredo vazio (nunca compara vazio com vazio)", () => {
    expect(introSuprimidaPelaCaptura("", "")).toBe(false);
  });

  it("caminho feliz: header bate com CAPTURA_SECRET", () => {
    expect(introSuprimidaPelaCaptura("segredo-certo", "segredo-certo")).toBe(true);
  });

  it("comparação de tamanhos diferentes não lança", () => {
    expect(introSuprimidaPelaCaptura("abc", "um-segredo-bem-mais-comprido")).toBe(false);
  });
});
