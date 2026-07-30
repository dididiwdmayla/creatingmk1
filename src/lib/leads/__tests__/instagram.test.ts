import { describe, expect, it } from "vitest";

import { handleInstagram } from "../instagram";

describe("handleInstagram", () => {
  it("com barra final", () => {
    expect(handleInstagram("https://www.instagram.com/barbearia.doze/")).toBe(
      "barbearia.doze",
    );
  });

  it("sem barra final", () => {
    expect(handleInstagram("https://www.instagram.com/barbearia.doze")).toBe(
      "barbearia.doze",
    );
  });

  it("com query string", () => {
    expect(handleInstagram("https://www.instagram.com/barbearia.doze/?hl=pt-br")).toBe(
      "barbearia.doze",
    );
  });

  it("perfil inexistente (URL raiz do instagram.com, sem handle)", () => {
    expect(handleInstagram("https://www.instagram.com/")).toBeUndefined();
  });

  it("URL que não é do instagram → undefined", () => {
    expect(handleInstagram("https://barbearia.com.br")).toBeUndefined();
  });

  it("ausente → undefined", () => {
    expect(handleInstagram(undefined)).toBeUndefined();
  });
});
