import { describe, expect, it } from "vitest";

import { cidadeDoEndereco } from "../cidade";

describe("cidadeDoEndereco", () => {
  it("endereço BR completo (rua, bairro, cidade-UF, CEP, país)", () => {
    expect(
      cidadeDoEndereco("R. Pernambuco, 122 - Zona 01, Maringá - PR, 87013-000, Brasil"),
    ).toEqual({ cidade: "Maringá - PR", pais: "Brasil" });
  });

  it("endereço argentino (CEP alfanumérico no início do segmento da cidade)", () => {
    expect(
      cidadeDoEndereco("Güemes 4818, C1425 Cdad. Autónoma de Buenos Aires, Argentina"),
    ).toEqual({ cidade: "Cdad. Autónoma de Buenos Aires", pais: "Argentina" });
  });

  it("endereço suíço (CEP numérico no início do segmento da cidade, sem segmento próprio)", () => {
    expect(cidadeDoEndereco("Bahnhofstrasse 1, 8001 Zürich, Switzerland")).toEqual({
      cidade: "Zürich",
      pais: "Switzerland",
    });
  });

  it("endereço alemão (CEP numérico no início do segmento da cidade, sem segmento próprio)", () => {
    expect(cidadeDoEndereco("Unter den Linden 1, 10117 Berlin, Germany")).toEqual({
      cidade: "Berlin",
      pais: "Germany",
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
