import { describe, expect, it } from "vitest";

import { cidadeDoEndereco } from "../cidade";

describe("cidadeDoEndereco", () => {
  it("endereço BR completo (rua, bairro, cidade-UF, CEP, país)", () => {
    expect(
      cidadeDoEndereco("R. Pernambuco, 122 - Zona 01, Maringá - PR, 87013-000, Brasil"),
    ).toBe("Maringá - PR");
  });

  it("endereço suíço/alemão (CEP grudado na cidade, sem segmento próprio)", () => {
    expect(cidadeDoEndereco("Bahnhofstrasse 1, 8001 Zürich, Switzerland")).toBe(
      "8001 Zürich",
    );
  });

  it("endereço sem CEP (número da rua isolado é descartado como se fosse CEP)", () => {
    expect(cidadeDoEndereco("Av. Brasil, 2785, Maringá, PR")).toBe("Maringá");
  });

  it("endereço curto demais (uma parte só, ou vazio) → undefined", () => {
    expect(cidadeDoEndereco("Brasil")).toBeUndefined();
    expect(cidadeDoEndereco("")).toBeUndefined();
  });
});
