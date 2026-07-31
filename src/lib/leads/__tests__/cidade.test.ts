import { describe, expect, it } from "vitest";

import { cidadeDoEndereco } from "../cidade";

describe("cidadeDoEndereco", () => {
  it("endereço BR completo (rua, bairro, cidade-UF, CEP, país)", () => {
    expect(
      cidadeDoEndereco("R. Pernambuco, 122 - Zona 01, Maringá - PR, 87013-000, Brasil"),
    ).toEqual({ cidade: "Maringá - PR", pais: "Brasil" });
  });

  it("endereço suíço/alemão (CEP grudado na cidade, sem segmento próprio)", () => {
    expect(cidadeDoEndereco("Bahnhofstrasse 1, 8001 Zürich, Switzerland")).toEqual({
      cidade: "8001 Zürich",
      pais: "Switzerland",
    });
  });

  it("endereço sem CEP (número da rua isolado é descartado como se fosse CEP)", () => {
    expect(cidadeDoEndereco("Av. Brasil, 2785, Maringá, PR")).toEqual({
      cidade: "Maringá",
      pais: "PR",
    });
  });

  it("endereço curto demais (uma parte só, ou vazio) → objeto vazio", () => {
    expect(cidadeDoEndereco("Brasil")).toEqual({});
    expect(cidadeDoEndereco("")).toEqual({});
  });
});
