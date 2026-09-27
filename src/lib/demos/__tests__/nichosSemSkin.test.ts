import { describe, expect, it } from "vitest";

import { nichosSemSkin } from "../nichosSemSkin";
import type { Busca } from "@/lib/buscas/types";

function busca(overrides: Partial<Busca> & Pick<Busca, "id" | "nicho">): Busca {
  return {
    nome: overrides.id,
    regiao: "Porto Alegre RS",
    cor: "#2f82e0",
    criadaEm: new Date().toISOString(),
    totalCriados: 0,
    totalExistentes: 0,
    ...overrides,
  };
}

describe("nichosSemSkin", () => {
  it("nunca lista nicho que já casa com skin (nem por sinônimo)", () => {
    const resultado = nichosSemSkin([
      busca({ id: "1", nicho: "barbearia" }),
      busca({ id: "2", nicho: "lanchonete" }), // sinônimo de lancheria
    ]);
    expect(resultado).toEqual([]);
  });

  it("agrupa pela normalização exata e soma buscas/leads corretamente", () => {
    const resultado = nichosSemSkin([
      busca({ id: "1", nicho: "dentista", totalCriados: 10, totalExistentes: 5 }),
      busca({ id: "2", nicho: "Dentista", totalCriados: 3, totalExistentes: 1 }),
      busca({ id: "3", nicho: "dentísta", totalCriados: 2, totalExistentes: 0 }), // acento
    ]);
    expect(resultado).toHaveLength(1);
    expect(resultado[0]).toMatchObject({ normalizado: "dentista", buscas: 3, leads: 21 });
  });

  it("rótulo exibido é o texto mais frequente do grupo", () => {
    const resultado = nichosSemSkin([
      busca({ id: "1", nicho: "clínica odontológica" }),
      busca({ id: "2", nicho: "clínica odontológica" }),
      busca({ id: "3", nicho: "dentista" }),
    ]);
    const dentistas = resultado.find((n) => n.normalizado === "clinicaodontologica");
    expect(dentistas?.nicho).toBe("clínica odontológica");
  });

  it("ordena por leads desc, depois por buscas, depois alfabético", () => {
    const resultado = nichosSemSkin([
      busca({ id: "1", nicho: "dentista", totalCriados: 5, totalExistentes: 0 }),
      busca({ id: "2", nicho: "advocacia", totalCriados: 20, totalExistentes: 0 }),
      busca({ id: "3", nicho: "estetica", totalCriados: 5, totalExistentes: 0 }),
    ]);
    expect(resultado.map((n) => n.normalizado)).toEqual(["advocacia", "dentista", "estetica"]);
  });

  it("lista vazia quando toda busca já casa com skin", () => {
    expect(nichosSemSkin([busca({ id: "1", nicho: "petshop" })])).toEqual([]);
  });

  it("lista vazia quando não há buscas", () => {
    expect(nichosSemSkin([])).toEqual([]);
  });
});
