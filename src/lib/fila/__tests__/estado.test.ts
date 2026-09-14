import { describe, expect, it } from "vitest";

import { TENTATIVAS_MAX, filaParado, type FilaEnvioDoc } from "../estado";

function envio(overrides: Partial<FilaEnvioDoc> = {}): FilaEnvioDoc {
  return {
    leadId: "ChIJa",
    estado: "falhou",
    claimId: "c",
    reservadoEm: "x",
    expiraEm: "x",
    dispositivo: "android",
    tentativas: 0,
    ultimoErro: null,
    enviadoEm: null,
    ...overrides,
  };
}

describe("filaParado", () => {
  it("lead que nunca passou pela fila não está parado", () => {
    expect(filaParado(undefined)).toBe(false);
    expect(filaParado(null)).toBe(false);
  });

  it("falhou com tentativa sobrando ainda volta", () => {
    expect(filaParado(envio({ tentativas: TENTATIVAS_MAX - 1 }))).toBe(false);
  });

  it("tentativas esgotadas: parado", () => {
    expect(filaParado(envio({ tentativas: TENTATIVAS_MAX }))).toBe(true);
  });

  it("enviado e invalido não são 'parado' — são conclusão, não travamento", () => {
    expect(filaParado(envio({ estado: "enviado", tentativas: 9 }))).toBe(false);
    expect(filaParado(envio({ estado: "invalido", tentativas: 9 }))).toBe(false);
  });
});
