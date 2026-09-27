import { describe, expect, it } from "vitest";

import type { CronExecucao } from "../cron";
import { situacaoCron } from "../cron-estado";

const INICIO = "2026-07-21T06:00:00.000Z";

function execucao(extra: Partial<CronExecucao> = {}): CronExecucao {
  return { em: INICIO, recorrentes: 1, buscas: [], totalNovos: 0, totalExistentes: 0, ...extra };
}

const depois = (segundos: number) => new Date(new Date(INICIO).getTime() + segundos * 1000);

describe("situacaoCron", () => {
  it("sem doc → nunca rodou", () => {
    expect(situacaoCron(null, depois(0))).toEqual({ tipo: "nunca" });
  });

  it("doc de antes do campo estado (só existia em rodada boa) → rodou", () => {
    expect(situacaoCron(execucao({ concluidaEm: INICIO }), depois(10)).tipo).toBe("rodou");
  });

  it("estado ok → rodou, mesmo com fila interrompida por cota", () => {
    const ultima = execucao({ estado: "ok", interrompida: { motivo: "Teto mensal atingido" } });
    expect(situacaoCron(ultima, depois(10)).tipo).toBe("rodou");
  });

  it("estado falhou → falhou, com a falha registrada", () => {
    const falha = { etapa: "config" as const, mensagem: "Firestore indisponível", em: INICIO };
    expect(situacaoCron(execucao({ estado: "falhou", falha }), depois(10))).toMatchObject({
      tipo: "falhou",
      falha,
    });
  });

  it("rodando dentro do teto da função → rodando; além do teto (+ folga) → não concluiu", () => {
    const ultima = execucao({ estado: "rodando" });
    expect(situacaoCron(ultima, depois(200)).tipo).toBe("rodando");
    expect(situacaoCron(ultima, depois(360)).tipo).toBe("rodando");
    expect(situacaoCron(ultima, depois(361)).tipo).toBe("nao-concluiu");
    expect(situacaoCron(ultima, depois(86_400)).tipo).toBe("nao-concluiu");
  });
});
