import { describe, expect, it } from "vitest";

import { getLedEstilo, LED_ESTILO_PADRAO, LED_ESTILOS } from "../registry";

describe("registro de estilos de LED", () => {
  it("tem ao menos um estilo e ids únicos", () => {
    expect(LED_ESTILOS.length).toBeGreaterThan(0);
    const ids = LED_ESTILOS.map((estilo) => estilo.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("o estilo padrão existe no registro (compatibilidade com todo preset existente)", () => {
    expect(getLedEstilo(LED_ESTILO_PADRAO)).toBeDefined();
  });

  it("getLedEstilo acha por id e devolve undefined para desconhecido", () => {
    expect(getLedEstilo(LED_ESTILOS[0].id)).toBe(LED_ESTILOS[0]);
    expect(getLedEstilo("nao-existe")).toBeUndefined();
    expect(getLedEstilo(undefined)).toBeUndefined();
  });

  it.each(LED_ESTILOS.map((estilo) => [estilo.id, estilo] as const))(
    "estilo %s cumpre o contrato",
    (_id, estilo) => {
      expect(estilo.id).toBeTruthy();
      expect(estilo.nome).toBeTruthy();
      expect(estilo.nichosRecomendados.length).toBeGreaterThan(0);
      for (const nicho of estilo.nichosRecomendados) {
        expect(typeof nicho).toBe("string");
        expect(nicho.length).toBeGreaterThan(0);
      }
    },
  );
});
